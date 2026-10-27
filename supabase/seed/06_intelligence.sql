-- Intelligence data produced without the ML service: a transparent heuristic that mirrors
-- the fallback documented for ml/edubase_ml/performance.py and electives.py. Re-runnable.
-- Run after 01-05. Safe to re-run: it clears its own output first.

-- 0) Make attendance realistic: a ~15% defaulter tail, the rest 80-98%.
with tgt as (
  select st.id student_id,
    case when abs(hashtext(st.roll_no||'def'))%100 < 15
         then 0.55 + (abs(hashtext(st.roll_no||'tgt'))%170)/1000.0
         else 0.80 + (abs(hashtext(st.roll_no||'tgt'))%180)/1000.0 end target
  from public.students st)
update public.attendance_records ar
set status = case
     when (abs(hashtext(ar.session_id::text || ar.student_id::text)) % 1000) / 1000.0 < t.target - 0.06 then 'present'
     when (abs(hashtext(ar.session_id::text || ar.student_id::text)) % 1000) / 1000.0 < t.target then 'late'
     when (abs(hashtext(ar.session_id::text || ar.student_id::text)) % 1000) / 1000.0 < t.target + (1 - t.target) * 0.15 then 'excused'
     else 'absent' end
from tgt t
where t.student_id = ar.student_id;

select private.refresh_attendance_rollup();

-- 1) Performance predictions.
delete from public.performance_predictions;
with term as (select id from public.academic_terms where is_current),
att as (
  select r.student_id, sum(r.attended)::numeric / nullif(sum(r.sessions),0) as frac
  from private.attendance_rollup r join term t on t.id = r.term_id group by r.student_id),
score as (
  select m.student_id, sum(m.obtained/e.max_marks*e.weightage)/nullif(sum(e.weightage),0)*100 as pct
  from public.marks m join public.exams e on e.id = m.exam_id
  join public.course_sections cs on cs.id = e.section_id join term t on t.id = cs.term_id
  group by m.student_id),
feat as (
  select st.id student_id, st.cgpa, a.frac att, s.pct score_pct,
    case when s.pct is null then null
         when s.pct >= 90 then 10 when s.pct >= 80 then 9 when s.pct >= 70 then 8
         when s.pct >= 60 then 7 when s.pct >= 50 then 6 when s.pct >= 40 then 5
         else round((s.pct/40*5)::numeric,1) end as term_gp
  from public.students st
  left join att a on a.student_id = st.id
  left join score s on s.student_id = st.id
  where st.status = 'active'),
pred as (
  select student_id, cgpa, att, score_pct, term_gp,
    round((least(10, greatest(0, case
      when cgpa is not null then 0.55*cgpa + 0.30*coalesce(term_gp, cgpa) + 0.15*coalesce(att,0.85)*10
      else 0.70*coalesce(term_gp,7) + 0.30*coalesce(att,0.85)*10 end)))::numeric, 2) as pgpa
  from feat)
insert into public.performance_predictions (student_id, term_id, predicted_gpa, risk_level, factors, model_version)
select p.student_id, (select id from term), p.pgpa,
  case when p.pgpa < 5.5 or coalesce(p.att,1) < 0.70 then 'high'
       when p.pgpa < 6.5 or coalesce(p.att,1) < 0.75 then 'medium'
       else 'low' end,
  jsonb_build_object(
    'attendance_pct', round(coalesce(p.att,0)*100,1),
    'current_score_pct', round(coalesce(p.score_pct,0),1),
    'prior_cgpa', p.cgpa,
    'basis', case when p.cgpa is not null then 'prior CGPA, term marks, attendance' else 'term marks and attendance (first year)' end),
  'heuristic-v1'
from pred p;

-- 2) Elective recommendations.
delete from public.recommendations where kind = 'elective';
with cand as (
  select st.id student_id, st.interests, c.id course_id, c.code, c.title, c.tags,
         cardinality(array(select unnest(c.tags) intersect select unnest(st.interests))) as overlap,
         (select count(*) from public.enrollments e
            join public.course_sections cs on cs.id = e.section_id where cs.course_id = c.id) as popularity
  from public.students st
  join public.programs p on p.id = st.program_id
  join public.courses c on c.department_id = p.department_id and c.semester = st.current_semester and c.is_elective
  where st.status = 'active'
    and not exists (select 1 from public.enrollments e join public.course_sections cs on cs.id = e.section_id
                    where e.student_id = st.id and cs.course_id = c.id)),
ranked as (
  select *, row_number() over (partition by student_id order by overlap desc, popularity desc) rn,
         max(overlap) over (partition by student_id) max_ov from cand)
insert into public.recommendations (student_id, kind, payload, score, model_version)
select student_id, 'elective',
  jsonb_build_object('course_id', course_id, 'code', code, 'title', title,
    'reason', case when overlap > 0
       then 'Matches your interests: ' || array_to_string(array(select unnest(tags) intersect select unnest(interests)), ', ')
       else 'Popular elective in your department' end),
  round((0.5 * overlap / nullif(greatest(max_ov,1),0) + 0.5 * least(popularity,120)/120.0)::numeric, 4),
  'content+popularity-v1'
from ranked where rn <= 3;

-- 3) Placement preparation (skill gaps for final-year students).
delete from public.recommendations where kind = 'placement_prep';
with elig as (
  select st.id student_id, d.id drive_id, co.name company, d.package_lpa, s.skill
  from public.students st
  join public.placement_drives d on st.program_id = any(d.eligible_programs)
  join public.companies co on co.id = d.company_id
  cross join lateral unnest(d.required_skills) s(skill)
  where st.current_semester = 7 and st.status='active' and d.status = 'upcoming' and st.cgpa >= d.min_cgpa),
gaps as (
  select e.student_id, e.skill, sum(e.package_lpa) weighted, count(distinct e.drive_id) drives,
         array_agg(distinct e.company) companies
  from elig e
  where not exists (select 1 from public.student_skills ss where ss.student_id=e.student_id and ss.skill=e.skill)
  group by e.student_id, e.skill),
ranked as (select *, row_number() over (partition by student_id order by weighted desc) rn,
                  max(weighted) over (partition by student_id) mx from gaps)
insert into public.recommendations (student_id, kind, payload, score, model_version)
select student_id, 'placement_prep',
  jsonb_build_object('skill', skill, 'unlocks_drives', drives,
    'reason', 'Required by ' || array_to_string(companies, ', ') || '. Build this to qualify.'),
  round((weighted/nullif(mx,0))::numeric,4), 'skill-gap-v1'
from ranked where rn <= 4;
