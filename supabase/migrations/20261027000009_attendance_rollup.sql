-- Attendance roll-up. Aggregating ~500k attendance rows on every page view took seconds,
-- so per-student/per-section counts are kept in a materialized view refreshed by pg_cron.
-- Views below read the roll-up and join students, so RLS on students still scopes results.

create extension if not exists pg_cron;

create materialized view private.attendance_rollup as
select ar.student_id, s.section_id, cs.term_id,
       count(*)::int                                                    as sessions,
       count(*) filter (where ar.status in ('present', 'late'))::int   as attended
from public.attendance_records ar
join public.attendance_sessions s on s.id = ar.session_id
join public.course_sections cs on cs.id = s.section_id
group by ar.student_id, s.section_id, cs.term_id;

create unique index on private.attendance_rollup (student_id, section_id);
create index on private.attendance_rollup (section_id);
create index on private.attendance_rollup (term_id);

grant select on private.attendance_rollup to authenticated;

create or replace function private.refresh_attendance_rollup()
returns void language sql security definer set search_path = '' as $$
  refresh materialized view concurrently private.attendance_rollup;
$$;

select cron.schedule('refresh-attendance-rollup', '*/10 * * * *', 'select private.refresh_attendance_rollup()');

-- Per-student current-term attendance, filtered through students (RLS).
create or replace view public.v_student_attendance with (security_invoker = true) as
select r.student_id, r.section_id, r.sessions::bigint as sessions, r.attended::bigint as attended,
       round(100.0 * r.attended / nullif(r.sessions, 0), 1) as percentage
from private.attendance_rollup r
join public.students st on st.id = r.student_id;

create or replace view public.v_dashboard_kpis with (security_invoker = true) as
select
  (select count(*) from public.students where status = 'active')                             as active_students,
  (select count(*) from public.faculty where is_active)                                      as active_faculty,
  (select count(*) from public.rooms)                                                        as rooms,
  (select round(100.0 * sum(r.attended) / nullif(sum(r.sessions), 0), 1)
     from private.attendance_rollup r
     join public.academic_terms t on t.id = r.term_id and t.is_current)                      as attendance_pct,
  (select count(*) from public.grievances where status in ('open', 'assigned', 'in_progress')) as open_grievances,
  (select count(*) from public.events where starts_at >= now())                              as upcoming_events,
  (select count(*) from public.timetable_slots ts
     join public.course_sections cs on cs.id = ts.section_id
     join public.academic_terms t on t.id = cs.term_id and t.is_current
    where ts.room_id is null)                                                                as unassigned_slots;

create or replace view public.v_department_attendance with (security_invoker = true) as
select d.code as department, d.name,
       round(100.0 * sum(r.attended) / nullif(sum(r.sessions), 0), 1) as attendance_pct
from private.attendance_rollup r
join public.academic_terms t on t.id = r.term_id and t.is_current
join public.course_sections cs on cs.id = r.section_id
join public.courses c on c.id = cs.course_id
join public.departments d on d.id = c.department_id
group by d.code, d.name;

create or replace view public.v_student_directory with (security_invoker = true) as
select st.id, st.roll_no, st.full_name, st.email, st.batch_year, st.current_semester, st.cgpa, st.status,
       p.code as program_code, d.code as department,
       att.attendance_pct,
       pr.predicted_gpa, pr.risk_level
from public.students st
join public.programs p on p.id = st.program_id
join public.departments d on d.id = p.department_id
left join (
  select r.student_id, round(100.0 * sum(r.attended) / nullif(sum(r.sessions), 0), 1) as attendance_pct
  from private.attendance_rollup r
  join public.academic_terms t on t.id = r.term_id and t.is_current
  group by r.student_id
) att on att.student_id = st.id
left join lateral (
  select predicted_gpa, risk_level from public.performance_predictions
  where student_id = st.id order by created_at desc limit 1
) pr on true;

-- Enrolment counts were a correlated count per section row.
create index if not exists enrollments_section_student_idx on public.enrollments (section_id, student_id);
