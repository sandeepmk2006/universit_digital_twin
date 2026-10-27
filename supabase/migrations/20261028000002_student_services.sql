-- Student profile details, leave applications and service requests (bonafide
-- certificates, ID cards ...), mirroring what a student portal offers.

alter table public.students
  add column mobile         text,
  add column blood_group    text,
  add column nationality    text not null default 'Indian',
  add column address        text,
  add column city           text,
  add column pincode        text,
  add column admission_date date,
  add column admission_type text not null default 'Regular';

create table public.leave_requests (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students(id) on delete cascade,
  leave_type   text not null check (leave_type in ('medical', 'on_duty', 'personal', 'emergency')),
  subject      text not null,
  reason       text,
  from_date    date not null,
  to_date      date not null,
  from_session text not null default 'full_day' check (from_session in ('full_day', 'forenoon', 'afternoon')),
  to_session   text not null default 'full_day' check (to_session in ('full_day', 'forenoon', 'afternoon')),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by  uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  check (to_date >= from_date)
);
create index on public.leave_requests (student_id, created_at desc);

create table public.service_requests (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  service     text not null,
  purpose     text,
  fee         numeric(8,2) not null default 0,
  status      text not null default 'submitted' check (status in ('submitted', 'processing', 'ready', 'rejected')),
  created_at  timestamptz not null default now()
);
create index on public.service_requests (student_id, created_at desc);

alter table public.leave_requests enable row level security;
alter table public.service_requests enable row level security;

-- Students see and file their own; staff see and decide on all.
create policy "read: own or staff" on public.leave_requests for select to authenticated
  using (student_id = (select private.my_student_id()) or (select private.is_staff()));
create policy "insert: own" on public.leave_requests for insert to authenticated
  with check (student_id = (select private.my_student_id()) and status = 'pending');
create policy "update: staff" on public.leave_requests for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

create policy "read: own or staff" on public.service_requests for select to authenticated
  using (student_id = (select private.my_student_id()) or (select private.is_staff()));
create policy "insert: own" on public.service_requests for insert to authenticated
  with check (student_id = (select private.my_student_id()) and status = 'submitted');
create policy "update: staff" on public.service_requests for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

-- Guardians were readable only as student-owned; keep that, nothing else needed.
