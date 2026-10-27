-- Timetable, attendance, examinations, faculty workload.

create table public.timetable_slots (
  id          uuid primary key default gen_random_uuid(),
  section_id  uuid not null references public.course_sections(id) on delete cascade,
  room_id     uuid references public.rooms(id),
  weekday     smallint not null check (weekday between 1 and 6),   -- Mon=1
  starts_at   time not null,
  ends_at     time not null,
  check (ends_at > starts_at)
);
create index on public.timetable_slots (room_id, weekday);
create index on public.timetable_slots (section_id);

-- A room can't host two classes that overlap.
create extension if not exists btree_gist;
alter table public.timetable_slots add constraint timetable_no_room_clash
  exclude using gist (
    room_id with =,
    weekday with =,
    tsrange('2000-01-01'::date + starts_at, '2000-01-01'::date + ends_at) with &&
  );

create table public.attendance_sessions (
  id          uuid primary key default gen_random_uuid(),
  section_id  uuid not null references public.course_sections(id) on delete cascade,
  held_on     date not null,
  starts_at   time not null,
  taken_by    uuid references public.faculty(id),
  unique (section_id, held_on, starts_at)
);

create table public.attendance_records (
  session_id  uuid not null references public.attendance_sessions(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  status      text not null check (status in ('present', 'absent', 'late', 'excused')),
  primary key (session_id, student_id)
);
create index on public.attendance_records (student_id);

create table public.exams (
  id          uuid primary key default gen_random_uuid(),
  section_id  uuid not null references public.course_sections(id) on delete cascade,
  kind        text not null check (kind in ('internal_1', 'internal_2', 'assignment', 'lab', 'end_semester')),
  max_marks   numeric(5,2) not null check (max_marks > 0),
  weightage   numeric(5,2) not null check (weightage between 0 and 100),
  held_on     date,
  room_id     uuid references public.rooms(id)
);
create index on public.exams (section_id);

create table public.marks (
  exam_id     uuid not null references public.exams(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  obtained    numeric(5,2) not null check (obtained >= 0),
  primary key (exam_id, student_id)
);
create index on public.marks (student_id);

-- Derived views ---------------------------------------------------------------

create view public.v_student_attendance with (security_invoker = true) as
select
  ar.student_id,
  s.section_id,
  count(*)                                                   as sessions,
  count(*) filter (where ar.status in ('present', 'late'))  as attended,
  round(100.0 * count(*) filter (where ar.status in ('present', 'late')) / nullif(count(*), 0), 1) as percentage
from public.attendance_records ar
join public.attendance_sessions s on s.id = ar.session_id
group by ar.student_id, s.section_id;

create view public.v_faculty_workload with (security_invoker = true) as
select
  f.id as faculty_id,
  f.full_name,
  f.department_id,
  f.max_weekly_hours,
  coalesce(sum(extract(epoch from (t.ends_at - t.starts_at)) / 3600), 0)::numeric(5,1) as weekly_hours,
  count(distinct cs.id) as sections
from public.faculty f
left join public.course_sections cs on cs.faculty_id = f.id
left join public.academic_terms at on at.id = cs.term_id and at.is_current
left join public.timetable_slots t on t.section_id = cs.id and at.id is not null
group by f.id;
