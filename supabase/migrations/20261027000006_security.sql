-- Row Level Security.
--
-- Access model
--   * catalogue tables  : any signed-in user reads; staff write
--   * student-owned     : the student reads own rows; staff read/write all
--   * profile-owned     : the owner reads/writes own rows; staff read/write all
--   * staff-only        : staff only
-- "Staff" is every role except student and alumni. Fine-grained per-department
-- restrictions live in the application layer for now.

create or replace function private.my_role()
returns public.user_role language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select role not in ('student', 'alumni') from public.profiles where id = (select auth.uid())),
    false)
$$;

create or replace function private.my_student_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.students where profile_id = (select auth.uid())
$$;

grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;

-- New auth users get a profile automatically (role defaults to student;
-- admins promote via the dashboard).
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)), new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

do $$
declare
  t text;
  catalogue text[] := array[
    'departments', 'programs', 'buildings', 'rooms', 'academic_terms', 'courses',
    'course_sections', 'timetable_slots', 'faculty', 'exams', 'hostels', 'hostel_rooms',
    'books', 'book_copies', 'bus_routes', 'bus_stops', 'buses', 'bus_locations',
    'clubs', 'club_members', 'events', 'sports_facilities', 'facility_bookings',
    'companies', 'placement_drives', 'research_projects', 'publications',
    'publication_authors', 'alumni', 'fee_structures', 'feedback_forms', 'kb_documents'
  ];
  student_owned text[] := array[
    'guardians', 'enrollments', 'attendance_records', 'marks', 'hostel_allocations',
    'hostel_complaints', 'sports_achievements', 'student_skills', 'placement_applications',
    'invoices', 'scholarships', 'performance_predictions', 'recommendations'
  ];
  staff_only text[] := array[
    'attendance_sessions', 'applicants', 'visitors', 'expenses', 'inventory_items',
    'inventory_movements', 'medicine_stock', 'room_allocation_runs'
  ];
begin
  foreach t in array catalogue || student_owned || staff_only || array[
    'profiles', 'students', 'book_loans', 'bus_passes', 'event_registrations', 'medical_visits',
    'chat_sessions', 'chat_messages', 'feedback_responses', 'grievances', 'grievance_updates',
    'payments', 'placement_offers'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;

  foreach t in array catalogue loop
    execute format('create policy "read: signed-in" on public.%I for select to authenticated using (true)', t);
    execute format('create policy "write: staff" on public.%I for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()))', t);
  end loop;

  foreach t in array student_owned loop
    execute format('create policy "read: own or staff" on public.%I for select to authenticated using (student_id = (select private.my_student_id()) or (select private.is_staff()))', t);
    execute format('create policy "write: staff" on public.%I for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()))', t);
  end loop;

  foreach t in array staff_only loop
    execute format('create policy "all: staff" on public.%I for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()))', t);
  end loop;
end $$;

-- Students may file complaints, list skills and apply to drives themselves.
create policy "insert: own" on public.hostel_complaints for insert to authenticated
  with check (student_id = (select private.my_student_id()));
create policy "insert: own" on public.placement_applications for insert to authenticated
  with check (student_id = (select private.my_student_id()));
create policy "manage: own" on public.student_skills for all to authenticated
  using (student_id = (select private.my_student_id()))
  with check (student_id = (select private.my_student_id()));

-- Profiles: users see and edit their own; staff see everyone. Role changes are admin-only.
create policy "read: self or staff" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_staff()));
create policy "update: self" on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and role = (select private.my_role()));
create policy "all: admin" on public.profiles for all to authenticated
  using ((select private.my_role()) = 'admin') with check ((select private.my_role()) = 'admin');

create policy "read: self or staff" on public.students for select to authenticated
  using (profile_id = (select auth.uid()) or (select private.is_staff()));
create policy "write: staff" on public.students for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

-- Profile-owned records.
create policy "read: own or staff" on public.book_loans for select to authenticated
  using (borrower_id = (select auth.uid()) or (select private.is_staff()));
create policy "write: staff" on public.book_loans for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

create policy "read: own or staff" on public.bus_passes for select to authenticated
  using (profile_id = (select auth.uid()) or (select private.is_staff()));
create policy "write: staff" on public.bus_passes for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

create policy "manage: own" on public.event_registrations for all to authenticated
  using (profile_id = (select auth.uid()) or (select private.is_staff()))
  with check (profile_id = (select auth.uid()) or (select private.is_staff()));

create policy "read: own" on public.medical_visits for select to authenticated
  using (patient_id = (select auth.uid()));
create policy "all: medical staff" on public.medical_visits for all to authenticated
  using ((select private.my_role()) in ('doctor', 'admin'))
  with check ((select private.my_role()) in ('doctor', 'admin'));

create policy "manage: own" on public.chat_sessions for all to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy "manage: own" on public.chat_messages for all to authenticated
  using (exists (select 1 from public.chat_sessions s where s.id = session_id and s.profile_id = (select auth.uid())))
  with check (exists (select 1 from public.chat_sessions s where s.id = session_id and s.profile_id = (select auth.uid())));

create policy "manage: own" on public.feedback_responses for all to authenticated
  using (respondent_id = (select auth.uid()) or (select private.is_staff()))
  with check (respondent_id = (select auth.uid()));

create policy "read: own or staff" on public.grievances for select to authenticated
  using (raised_by = (select auth.uid()) or assigned_to = (select auth.uid()) or (select private.is_staff()));
create policy "insert: own" on public.grievances for insert to authenticated
  with check (raised_by = (select auth.uid()));
create policy "update: staff" on public.grievances for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

create policy "read: participants" on public.grievance_updates for select to authenticated
  using ((select private.is_staff()) or exists (
    select 1 from public.grievances g where g.id = grievance_id and g.raised_by = (select auth.uid())));
create policy "insert: participants" on public.grievance_updates for insert to authenticated
  with check (author_id = (select auth.uid()) and ((select private.is_staff()) or exists (
    select 1 from public.grievances g where g.id = grievance_id and g.raised_by = (select auth.uid()))));

create policy "read: own or staff" on public.payments for select to authenticated
  using ((select private.is_staff()) or exists (
    select 1 from public.invoices i where i.id = invoice_id and i.student_id = (select private.my_student_id())));
create policy "write: staff" on public.payments for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

create policy "read: own or staff" on public.placement_offers for select to authenticated
  using ((select private.is_staff()) or exists (
    select 1 from public.placement_applications a where a.id = application_id and a.student_id = (select private.my_student_id())));
create policy "write: staff" on public.placement_offers for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
