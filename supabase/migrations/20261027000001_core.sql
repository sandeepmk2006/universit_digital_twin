-- EduBase core: identity, organisation structure, physical campus, academic catalogue.

create extension if not exists pgcrypto;
create extension if not exists citext;

create schema if not exists private;

create type public.user_role as enum (
  'admin', 'faculty', 'hod', 'student', 'warden', 'placement_officer',
  'librarian', 'transport_manager', 'doctor', 'security', 'accountant', 'alumni'
);

create type public.room_kind as enum ('classroom', 'lab', 'seminar_hall', 'auditorium', 'office', 'hostel_room', 'other');

create or replace function private.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Organisation ---------------------------------------------------------------

create table public.departments (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  created_at  timestamptz not null default now()
);

create table public.programs (
  id             uuid primary key default gen_random_uuid(),
  department_id  uuid not null references public.departments(id),
  code           text not null unique,
  name           text not null,
  degree         text not null,              -- B.Tech, M.Tech, MBA, PhD ...
  duration_years smallint not null check (duration_years between 1 and 6),
  created_at     timestamptz not null default now()
);
create index on public.programs (department_id);

-- People ---------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        public.user_role not null default 'student',
  full_name   text not null,
  email       citext not null unique,
  phone       text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

create table public.faculty (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid unique references public.profiles(id) on delete set null,
  employee_no    text not null unique,
  full_name      text not null,
  email          citext not null unique,
  department_id  uuid not null references public.departments(id),
  designation    text not null,              -- Professor, Associate Professor ...
  max_weekly_hours smallint not null default 16,
  joined_on      date not null,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);
create index on public.faculty (department_id);

alter table public.departments add column hod_id uuid references public.faculty(id);

create table public.students (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid unique references public.profiles(id) on delete set null,
  roll_no        text not null unique,
  full_name      text not null,
  email          citext not null unique,
  gender         text check (gender in ('male', 'female', 'other')),
  date_of_birth  date,
  program_id     uuid not null references public.programs(id),
  batch_year     smallint not null,
  current_semester smallint not null default 1 check (current_semester between 1 and 12),
  mentor_id      uuid references public.faculty(id),
  cgpa           numeric(4,2) check (cgpa between 0 and 10),
  status         text not null default 'active' check (status in ('active', 'graduated', 'dropped', 'suspended')),
  interests      text[] not null default '{}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on public.students (program_id, batch_year);
create index on public.students (mentor_id);
create trigger students_touch before update on public.students
  for each row execute function private.touch_updated_at();

create table public.guardians (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  name        text not null,
  relation    text not null,
  phone       text not null,
  email       citext
);
create index on public.guardians (student_id);

-- Campus ---------------------------------------------------------------------

create table public.buildings (
  id      uuid primary key default gen_random_uuid(),
  code    text not null unique,
  name    text not null,
  floors  smallint not null default 1
);

create table public.rooms (
  id           uuid primary key default gen_random_uuid(),
  building_id  uuid not null references public.buildings(id),
  code         text not null unique,
  kind         public.room_kind not null,
  capacity     smallint not null check (capacity > 0),
  floor        smallint not null default 0,
  equipment    text[] not null default '{}',   -- projector, smart_board, computers, ...
  is_available boolean not null default true
);
create index on public.rooms (building_id);
create index on public.rooms (kind, capacity);

-- Academic catalogue ---------------------------------------------------------

create table public.academic_terms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,            -- e.g. "2026 Odd"
  starts_on   date not null,
  ends_on     date not null,
  is_current  boolean not null default false,
  check (ends_on > starts_on)
);
create unique index academic_terms_one_current on public.academic_terms (is_current) where is_current;

create table public.courses (
  id             uuid primary key default gen_random_uuid(),
  department_id  uuid not null references public.departments(id),
  code           text not null unique,
  title          text not null,
  credits        smallint not null check (credits between 0 and 10),
  semester       smallint not null,
  is_elective    boolean not null default false,
  requires_lab   boolean not null default false,
  tags           text[] not null default '{}',
  description    text
);
create index on public.courses (department_id, semester);

create table public.course_sections (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses(id),
  term_id     uuid not null references public.academic_terms(id),
  section     text not null default 'A',
  faculty_id  uuid references public.faculty(id),
  capacity    smallint not null default 60,
  unique (course_id, term_id, section)
);
create index on public.course_sections (faculty_id);
create index on public.course_sections (term_id);

create table public.enrollments (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  section_id  uuid not null references public.course_sections(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  grade       text,
  grade_point numeric(4,2),
  unique (student_id, section_id)
);
create index on public.enrollments (section_id);
