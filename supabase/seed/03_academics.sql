-- Sections, enrollments and a clash-free timetable for the current and previous term.

select setseed(0.3);

-- Current term (2026 Odd): odd-semester courses. Core courses get one section per 60 students,
-- electives a single section.
insert into public.course_sections (course_id, term_id, section, capacity)
select c.id, t.id, sec, 60
from public.courses c
join public.departments d on d.id = c.department_id
cross join public.academic_terms t
cross join lateral unnest(case when c.is_elective then array['A'] else array['A', 'B'] end) sec
where t.name = '2026 Odd'
  and c.semester % 2 = 1
  and (d.code <> 'MBA' or c.semester <= 3);

-- Previous term (2026 Even): even-semester courses for students who are now in semester 3/5/7.
insert into public.course_sections (course_id, term_id, section, capacity)
select c.id, t.id, sec, 60
from public.courses c
join public.departments d on d.id = c.department_id
cross join public.academic_terms t
cross join unnest(array['A', 'B']) sec
where t.name = '2026 Even'
  and c.semester % 2 = 0
  and (d.code <> 'MBA' or c.semester = 2);

-- Faculty: round-robin inside each department, weighted toward assistant professors.
with ranked as (
  select cs.id, c.department_id,
         row_number() over (partition by c.department_id, cs.term_id order by c.semester, c.code, cs.section) as rn
  from public.course_sections cs join public.courses c on c.id = cs.course_id
), pool as (
  select id, department_id, row_number() over (partition by department_id order by employee_no) as k,
         count(*) over (partition by department_id) as total
  from public.faculty
)
update public.course_sections cs
set faculty_id = p.id
from ranked r
join pool p on p.department_id = r.department_id and p.k = 1 + (r.rn % p.total)
where cs.id = r.id;

-- Enrollments: core courses by section (odd roll numbers -> A, even -> B); one elective per student.
insert into public.enrollments (student_id, section_id)
select s.student_id, cs.id
from private.seed_students s
join public.students st on st.id = s.student_id
join public.courses c on c.department_id = (select department_id from public.programs where id = s.program_id)
                     and c.semester = st.current_semester and not c.is_elective
join public.course_sections cs on cs.course_id = c.id
join public.academic_terms t on t.id = cs.term_id and t.is_current
where cs.section = case when s.n % 2 = 1 then 'A' else 'B' end;

insert into public.enrollments (student_id, section_id)
select distinct on (s.student_id) s.student_id, cs.id
from private.seed_students s
join public.students st on st.id = s.student_id
join public.courses c on c.department_id = (select department_id from public.programs where id = s.program_id)
                     and c.semester = st.current_semester and c.is_elective
join public.course_sections cs on cs.course_id = c.id
join public.academic_terms t on t.id = cs.term_id and t.is_current
order by s.student_id,
         -- students mostly pick electives that match their interests
         (case when c.tags && st.interests then 0 else 1 end) + random() * 1.5;

insert into public.enrollments (student_id, section_id)
select s.student_id, cs.id
from private.seed_students s
join public.students st on st.id = s.student_id
join public.courses c on c.department_id = (select department_id from public.programs where id = s.program_id)
                     and c.semester = st.current_semester - 1
join public.course_sections cs on cs.course_id = c.id
join public.academic_terms t on t.id = cs.term_id and t.name = '2026 Even'
where st.current_semester > 1
  and cs.section = case when s.n % 2 = 1 then 'A' else 'B' end;

-- Timetable: 3 slots a week per section. A student group's courses never overlap because the time
-- depends only on the course's slot within its semester; rooms are assigned greedily without clashes,
-- current term first. Slots that find no free room stay unassigned for the allocation optimiser.
create table private.seed_slots as
select cs.id as section_id, t.is_current, c.requires_lab,
       (select count(*) from public.enrollments e where e.section_id = cs.id) as size,
       (((right(c.code, 2))::int - 1) * 3 + j) * 5 % 42 as t
from public.course_sections cs
join public.academic_terms t on t.id = cs.term_id
join public.courses c on c.id = cs.course_id
cross join generate_series(0, 2) j;

do $$
declare
  s record;
  chosen uuid;
  starts time[] := array['09:00', '10:00', '11:15', '12:15', '14:00', '15:00', '16:00']::time[];
  wd int; p int;
begin
  for s in select * from private.seed_slots order by is_current desc, requires_lab desc, size desc loop
    wd := s.t % 6 + 1;
    p  := s.t / 6 + 1;
    select r.id into chosen
    from public.rooms r
    where r.kind = case when s.requires_lab then 'lab'::public.room_kind else 'classroom'::public.room_kind end
      and not exists (select 1 from public.timetable_slots x where x.room_id = r.id and x.weekday = wd and x.starts_at = starts[p])
    order by (r.capacity >= s.size) desc, abs(r.capacity - s.size), r.code
    limit 1;

    insert into public.timetable_slots (section_id, room_id, weekday, starts_at, ends_at)
    values (s.section_id, chosen, wd, starts[p], starts[p] + interval '55 minutes');
  end loop;
end $$;

drop table private.seed_slots;

-- Attendance: every class held so far this term; a sample of weeks for the previous term.
select setseed(0.4);

insert into public.attendance_sessions (section_id, held_on, starts_at, taken_by)
select ts.section_id, d::date, ts.starts_at, cs.faculty_id
from public.timetable_slots ts
join public.course_sections cs on cs.id = ts.section_id
join public.academic_terms t on t.id = cs.term_id
cross join lateral generate_series(
  t.starts_on,
  case when t.is_current then date '2026-10-23' else t.starts_on + 83 end,
  interval '1 day') d
where extract(isodow from d) = ts.weekday
  and (t.is_current or extract(week from d)::int % 7 = 0)
on conflict do nothing;

insert into public.attendance_records (session_id, student_id, status)
select a.id, e.student_id,
       case when r < p * 0.94 then 'present'
            when r < p then 'late'
            when r < p + (1 - p) * 0.12 then 'excused'
            else 'absent' end
from public.attendance_sessions a
join public.enrollments e on e.section_id = a.section_id
join private.seed_students s on s.student_id = e.student_id
cross join lateral (
  select random() as r,
         -- weaker students drift downward as the term goes on
         greatest(0.35, s.diligence - case when s.ability < 0.25 then (a.held_on - date '2026-07-20') / 400.0 else 0 end) as p
) x;

-- Assessments and marks, driven by the latent ability plus attendance.
select setseed(0.5);

insert into public.exams (section_id, kind, max_marks, weightage, held_on, room_id)
select cs.id, k.kind, k.max_marks, k.weightage,
       case when t.is_current then k.cur_date else k.past_date end,
       (select room_id from public.timetable_slots where section_id = cs.id and room_id is not null limit 1)
from public.course_sections cs
join public.academic_terms t on t.id = cs.term_id
join public.courses c on c.id = cs.course_id
cross join (values
  ('internal_1',   50, 15, date '2026-08-28', date '2026-02-20'),
  ('assignment',   20, 10, date '2026-09-15', date '2026-03-10'),
  ('internal_2',   50, 15, date '2026-10-16', date '2026-04-10'),
  ('lab',          50, 10, date '2026-10-20', date '2026-04-25'),
  ('end_semester', 100, 50, null,             date '2026-05-15')
) k(kind, max_marks, weightage, cur_date, past_date)
where (k.kind <> 'lab' or c.requires_lab)
  and (k.kind <> 'end_semester' or not t.is_current);

with att as (
  select student_id, avg(case when status in ('present', 'late') then 1.0 else 0 end) as pct
  from public.attendance_records group by student_id
)
insert into public.marks (exam_id, student_id, obtained)
select x.id, e.student_id,
       round((x.max_marks * least(1, greatest(0.04,
         0.33 + 0.62 * s.ability + 0.25 * (coalesce(att.pct, 0.8) - 0.8) + (random() - 0.5) * 0.24
         + case when x.kind in ('assignment', 'lab') then 0.08 else 0 end)))::numeric, 1)
from public.exams x
join public.enrollments e on e.section_id = x.section_id
join private.seed_students s on s.student_id = e.student_id
left join att on att.student_id = e.student_id;

-- Grades for the completed term from weighted totals.
with totals as (
  select e.id, sum(m.obtained / x.max_marks * x.weightage) / sum(x.weightage) * 100 as pct
  from public.enrollments e
  join public.course_sections cs on cs.id = e.section_id
  join public.academic_terms t on t.id = cs.term_id and not t.is_current
  join public.exams x on x.section_id = cs.id
  join public.marks m on m.exam_id = x.id and m.student_id = e.student_id
  group by e.id
)
update public.enrollments e
set grade = g.grade, grade_point = g.gp
from totals
cross join lateral (
  select case when pct >= 90 then 'O' when pct >= 80 then 'A+' when pct >= 70 then 'A'
              when pct >= 60 then 'B+' when pct >= 50 then 'B' when pct >= 40 then 'C' else 'F' end as grade,
         case when pct >= 90 then 10 when pct >= 80 then 9 when pct >= 70 then 8
              when pct >= 60 then 7 when pct >= 50 then 6 when pct >= 40 then 5 else 0 end as gp
) g
where e.id = totals.id;
