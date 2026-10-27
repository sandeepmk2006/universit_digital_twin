-- Expose foreign keys the role dashboards filter on: faculty_id on the section and
-- timetable views, mentor_id on the student directory. Appended at the end so
-- create-or-replace is accepted.

create or replace view public.v_section_catalogue with (security_invoker = true) as
select cs.id, c.code, c.title, cs.section, c.semester, c.is_elective, c.requires_lab, d.code as department,
       t.name as term, t.is_current, f.full_name as faculty,
       (select count(*) from public.enrollments e where e.section_id = cs.id) as enrolled, cs.capacity,
       cs.faculty_id
from public.course_sections cs
join public.courses c on c.id = cs.course_id
join public.departments d on d.id = c.department_id
join public.academic_terms t on t.id = cs.term_id
left join public.faculty f on f.id = cs.faculty_id;

create or replace view public.v_timetable with (security_invoker = true) as
select ts.id, ts.weekday, ts.starts_at, ts.ends_at, ts.room_id, r.code as room, r.capacity as room_capacity,
       sc.id as section_id, sc.code as course_code, sc.title as course_title, sc.section, sc.department,
       sc.semester, sc.faculty, sc.enrolled, sc.is_current, sc.faculty_id
from public.timetable_slots ts
join public.v_section_catalogue sc on sc.id = ts.section_id
left join public.rooms r on r.id = ts.room_id;

create or replace view public.v_student_directory with (security_invoker = true) as
select st.id, st.roll_no, st.full_name, st.email, st.batch_year, st.current_semester, st.cgpa, st.status,
       p.code as program_code, d.code as department,
       att.attendance_pct, pr.predicted_gpa, pr.risk_level, st.mentor_id
from public.students st
join public.programs p on p.id = st.program_id
join public.departments d on d.id = p.department_id
left join (
  select r.student_id, round(100.0 * sum(r.attended) / nullif(sum(r.sessions),0), 1) as attendance_pct
  from private.attendance_rollup r
  join public.academic_terms t on t.id = r.term_id and t.is_current
  group by r.student_id
) att on att.student_id = st.id
left join lateral (
  select predicted_gpa, risk_level from public.performance_predictions
  where student_id = st.id order by created_at desc limit 1
) pr on true;
