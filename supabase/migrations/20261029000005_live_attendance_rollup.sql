-- Faculty now mark attendance in the app, so the attendance summary must change the
-- moment a mark is saved, not on the next 10-minute refresh. The materialised view
-- becomes a table kept in step by a trigger on attendance_records; the four reporting
-- views that read it are recreated unchanged.

drop view public.v_student_attendance;
drop view public.v_dashboard_kpis;
drop view public.v_department_attendance;
drop view public.v_student_directory;
select cron.unschedule('refresh-attendance-rollup');
drop materialized view private.attendance_rollup;

create table private.attendance_rollup (
  student_id uuid not null references public.students (id) on delete cascade,
  section_id uuid not null references public.course_sections (id) on delete cascade,
  term_id    uuid not null references public.academic_terms (id) on delete cascade,
  sessions   integer not null default 0 check (sessions >= 0),
  attended   integer not null default 0 check (attended between 0 and sessions),
  primary key (student_id, section_id)
);
create index on private.attendance_rollup (section_id);
create index on private.attendance_rollup (term_id);

insert into private.attendance_rollup (student_id, section_id, term_id, sessions, attended)
select ar.student_id, s.section_id, cs.term_id, count(*),
       count(*) filter (where ar.status in ('present', 'late'))
from public.attendance_records ar
join public.attendance_sessions s on s.id = ar.session_id
join public.course_sections cs on cs.id = s.section_id
group by 1, 2, 3;

grant select on private.attendance_rollup to authenticated;

-- One mark in, one mark out, or a status change: adjust that student's row for the section.
create or replace function private.sync_attendance_rollup() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_session uuid := coalesce(new.session_id, old.session_id);
  v_section uuid;
  v_term uuid;
  d_sessions integer := 0;
  d_attended integer := 0;
begin
  select s.section_id, cs.term_id into v_section, v_term
  from public.attendance_sessions s join public.course_sections cs on cs.id = s.section_id
  where s.id = v_session;
  if v_section is null then return null; end if;   -- session already deleted (cascade)

  if tg_op = 'INSERT' then
    d_sessions := 1;
    d_attended := (new.status in ('present', 'late'))::int;
  elsif tg_op = 'DELETE' then
    d_sessions := -1;
    d_attended := -(old.status in ('present', 'late'))::int;
  else
    d_attended := (new.status in ('present', 'late'))::int - (old.status in ('present', 'late'))::int;
  end if;

  insert into private.attendance_rollup as r (student_id, section_id, term_id, sessions, attended)
  values (coalesce(new.student_id, old.student_id), v_section, v_term, greatest(d_sessions, 0), greatest(d_attended, 0))
  on conflict (student_id, section_id) do update
    set sessions = r.sessions + d_sessions,
        attended = r.attended + d_attended;
  return null;
end $$;

create trigger attendance_rollup_sync
after insert or update of status or delete on public.attendance_records
for each row execute function private.sync_attendance_rollup();

-- Full rebuild kept for repairs; runs nightly as a safety net.
create or replace function private.refresh_attendance_rollup() returns void
language sql security definer set search_path = '' as $$
  delete from private.attendance_rollup;
  insert into private.attendance_rollup (student_id, section_id, term_id, sessions, attended)
  select ar.student_id, s.section_id, cs.term_id, count(*),
         count(*) filter (where ar.status in ('present', 'late'))
  from public.attendance_records ar
  join public.attendance_sessions s on s.id = ar.session_id
  join public.course_sections cs on cs.id = s.section_id
  group by 1, 2, 3;
$$;
select cron.schedule('rebuild-attendance-rollup', '30 2 * * *', 'select private.refresh_attendance_rollup()');

create view public.v_student_attendance with (security_invoker = true) as
select r.student_id, r.section_id, r.sessions::bigint as sessions, r.attended::bigint as attended,
       round(100.0 * r.attended / nullif(r.sessions, 0), 1) as percentage
from private.attendance_rollup r
join public.students st on st.id = r.student_id;

create view public.v_department_attendance with (security_invoker = true) as
select d.code as department, d.name,
       round(100.0 * sum(r.attended) / nullif(sum(r.sessions), 0), 1) as attendance_pct
from private.attendance_rollup r
join public.academic_terms t on t.id = r.term_id and t.is_current
join public.course_sections cs on cs.id = r.section_id
join public.courses c on c.id = cs.course_id
join public.departments d on d.id = c.department_id
group by d.code, d.name;

create view public.v_dashboard_kpis with (security_invoker = true) as
select (select count(*) from public.students where status = 'active') as active_students,
       (select count(*) from public.faculty where is_active) as active_faculty,
       (select count(*) from public.rooms) as rooms,
       (select round(100.0 * sum(r.attended) / nullif(sum(r.sessions), 0), 1)
          from private.attendance_rollup r
          join public.academic_terms t on t.id = r.term_id and t.is_current) as attendance_pct,
       (select count(*) from public.grievances where status in ('open', 'assigned', 'in_progress')) as open_grievances,
       (select count(*) from public.events where starts_at >= now()) as upcoming_events,
       (select count(*) from public.timetable_slots ts
          join public.course_sections cs on cs.id = ts.section_id
          join public.academic_terms t on t.id = cs.term_id and t.is_current
         where ts.room_id is null) as unassigned_slots;

create view public.v_student_directory with (security_invoker = true) as
select st.id, st.roll_no, st.full_name, st.email, st.batch_year, st.current_semester, st.cgpa, st.status,
       p.code as program_code, d.code as department, att.attendance_pct, pr.predicted_gpa, pr.risk_level, st.mentor_id
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

grant select on public.v_student_attendance, public.v_department_attendance,
  public.v_dashboard_kpis, public.v_student_directory to authenticated;
