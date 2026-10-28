-- Role-scoped access. Until now every non-student role passed private.is_staff() and
-- could read every student row, mark and invoice; the application hid the rest. Here
-- the database itself narrows each role to its own domain:
--   admin              everything
--   hod                students of their department
--   faculty            their mentees and the students in sections they teach
--   warden             residents of the hostels they run
--   accountant         fees; placement_officer: placements; librarian, transport,
--   doctor, security   their own module only

-- ---------- helpers ----------
create or replace function private.my_faculty_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.faculty where profile_id = (select auth.uid())
$$;

create or replace function private.my_department_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select department_id from public.faculty where profile_id = (select auth.uid())
$$;

create or replace function private.has_role(variadic roles public.user_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role = any(roles) from public.profiles where id = (select auth.uid())), false)
$$;

-- Students whose academic record (attendance, marks, predictions) the caller may see.
create or replace function private.academic_students() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select s.id from public.students s
  where (private.has_role('hod') and s.program_id in (
           select p.id from public.programs p where p.department_id = private.my_department_id()))
     or (private.has_role('faculty') and (
           s.mentor_id = private.my_faculty_id()
           or exists (select 1 from public.enrollments e
                      join public.course_sections cs on cs.id = e.section_id
                      where e.student_id = s.id and cs.faculty_id = private.my_faculty_id())))
$$;

-- Hostels run by the calling warden.
create or replace function private.my_hostels() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select id from public.hostels where warden_id = (select auth.uid())
$$;

-- Current residents of the calling warden's hostels.
create or replace function private.hostel_students() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select a.student_id from public.hostel_allocations a
  join public.hostel_rooms r on r.id = a.hostel_room_id
  where a.to_date is null and r.hostel_id in (select private.my_hostels())
$$;

revoke all on function private.my_faculty_id, private.my_department_id, private.has_role,
  private.academic_students, private.my_hostels, private.hostel_students from public;
grant execute on function private.my_faculty_id, private.my_department_id, private.has_role,
  private.academic_students, private.my_hostels, private.hostel_students to authenticated;

-- ---------- students and guardians ----------
drop policy "read: self or staff" on public.students;
drop policy "write: staff" on public.students;
create policy "read: scoped" on public.students for select to authenticated using (
  profile_id = (select auth.uid())
  or (select private.has_role('admin', 'accountant', 'placement_officer'))
  or id in (select private.academic_students())
  or id in (select private.hostel_students()));
create policy "write: admin" on public.students for all to authenticated
  using ((select private.has_role('admin'))) with check ((select private.has_role('admin')));

drop policy "read: own or staff" on public.guardians;
drop policy "write: staff" on public.guardians;
create policy "read: scoped" on public.guardians for select to authenticated using (
  student_id = (select private.my_student_id())
  or (select private.has_role('admin'))
  or student_id in (select private.academic_students())
  or student_id in (select private.hostel_students()));
create policy "write: admin" on public.guardians for all to authenticated
  using ((select private.has_role('admin'))) with check ((select private.has_role('admin')));

-- ---------- academic records ----------
do $$
declare t text;
begin
  foreach t in array array['enrollments', 'attendance_records', 'marks', 'performance_predictions', 'recommendations'] loop
    execute format('drop policy "read: own or staff" on public.%I', t);
    execute format('drop policy "write: staff" on public.%I', t);
    execute format($p$create policy "read: scoped" on public.%I for select to authenticated using (
      student_id = (select private.my_student_id())
      or (select private.has_role('admin'))
      or student_id in (select private.academic_students()))$p$, t);
    execute format($p$create policy "write: academic staff" on public.%I for all to authenticated
      using ((select private.has_role('admin')) or student_id in (select private.academic_students()))
      with check ((select private.has_role('admin')) or student_id in (select private.academic_students()))$p$, t);
  end loop;
end $$;

drop policy "all: staff" on public.attendance_sessions;
create policy "all: academic staff" on public.attendance_sessions for all to authenticated
  using ((select private.has_role('admin', 'hod', 'faculty')))
  with check ((select private.has_role('admin', 'hod', 'faculty')));

-- ---------- fees ----------
do $$
declare t text;
begin
  foreach t in array array['invoices', 'scholarships'] loop
    execute format('drop policy "read: own or staff" on public.%I', t);
    execute format('drop policy "write: staff" on public.%I', t);
    execute format($p$create policy "read: own or accounts" on public.%I for select to authenticated using (
      student_id = (select private.my_student_id()) or (select private.has_role('admin', 'accountant')))$p$, t);
    execute format($p$create policy "write: accounts" on public.%I for all to authenticated
      using ((select private.has_role('admin', 'accountant'))) with check ((select private.has_role('admin', 'accountant')))$p$, t);
  end loop;
end $$;

drop policy "read: own or staff" on public.payments;
drop policy "write: staff" on public.payments;
create policy "read: own or accounts" on public.payments for select to authenticated using (
  (select private.has_role('admin', 'accountant'))
  or exists (select 1 from public.invoices i where i.id = payments.invoice_id
             and i.student_id = (select private.my_student_id())));
create policy "write: accounts" on public.payments for all to authenticated
  using ((select private.has_role('admin', 'accountant'))) with check ((select private.has_role('admin', 'accountant')));

-- ---------- hostel ----------
drop policy "read: own or staff" on public.hostel_allocations;
drop policy "write: staff" on public.hostel_allocations;
create policy "read: own or warden" on public.hostel_allocations for select to authenticated using (
  student_id = (select private.my_student_id())
  or (select private.has_role('admin'))
  or hostel_room_id in (select r.id from public.hostel_rooms r where r.hostel_id in (select private.my_hostels())));
create policy "write: warden" on public.hostel_allocations for all to authenticated
  using ((select private.has_role('admin'))
         or hostel_room_id in (select r.id from public.hostel_rooms r where r.hostel_id in (select private.my_hostels())))
  with check ((select private.has_role('admin'))
         or hostel_room_id in (select r.id from public.hostel_rooms r where r.hostel_id in (select private.my_hostels())));

drop policy "read: own or staff" on public.hostel_complaints;
drop policy "write: staff" on public.hostel_complaints;
create policy "read: own or warden" on public.hostel_complaints for select to authenticated using (
  student_id = (select private.my_student_id())
  or (select private.has_role('admin'))
  or hostel_id in (select private.my_hostels()));
create policy "write: warden" on public.hostel_complaints for all to authenticated
  using ((select private.has_role('admin')) or hostel_id in (select private.my_hostels()))
  with check ((select private.has_role('admin')) or hostel_id in (select private.my_hostels()));

drop policy "write: staff" on public.hostel_rooms;
create policy "write: warden" on public.hostel_rooms for all to authenticated
  using ((select private.has_role('admin')) or hostel_id in (select private.my_hostels()))
  with check ((select private.has_role('admin')) or hostel_id in (select private.my_hostels()));
drop policy "write: staff" on public.hostels;
create policy "write: admin" on public.hostels for all to authenticated
  using ((select private.has_role('admin'))) with check ((select private.has_role('admin')));

-- ---------- requests ----------
drop policy "read: own or staff" on public.leave_requests;
drop policy "update: staff" on public.leave_requests;
create policy "read: own, mentor, hod or warden" on public.leave_requests for select to authenticated using (
  student_id = (select private.my_student_id())
  or (select private.has_role('admin'))
  or student_id in (select private.academic_students())
  or student_id in (select private.hostel_students()));
create policy "update: mentor, hod or warden" on public.leave_requests for update to authenticated
  using ((select private.has_role('admin'))
         or student_id in (select private.academic_students())
         or student_id in (select private.hostel_students()))
  with check ((select private.has_role('admin'))
         or student_id in (select private.academic_students())
         or student_id in (select private.hostel_students()));

drop policy "read: own or staff" on public.service_requests;
drop policy "update: staff" on public.service_requests;
create policy "read: own or office" on public.service_requests for select to authenticated using (
  student_id = (select private.my_student_id())
  or (select private.has_role('admin'))
  or ((select private.has_role('hod')) and student_id in (select private.academic_students())));
create policy "update: office" on public.service_requests for update to authenticated
  using ((select private.has_role('admin'))
         or ((select private.has_role('hod')) and student_id in (select private.academic_students())))
  with check ((select private.has_role('admin'))
         or ((select private.has_role('hod')) and student_id in (select private.academic_students())));

-- Each office handles the grievances of its own category.
create or replace function private.grievance_visible(category text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role('admin')
      or (private.has_role('hod') and category in ('academic', 'infrastructure', 'harassment', 'other'))
      or (private.has_role('warden') and category = 'hostel')
      or (private.has_role('accountant') and category = 'finance')
      or (private.has_role('transport_manager') and category = 'transport')
$$;
revoke all on function private.grievance_visible from public;
grant execute on function private.grievance_visible to authenticated;

drop policy "read: own or staff" on public.grievances;
drop policy "update: staff" on public.grievances;
create policy "read: own or handling office" on public.grievances for select to authenticated using (
  raised_by = (select auth.uid()) or assigned_to = (select auth.uid()) or private.grievance_visible(category));
create policy "update: handling office" on public.grievances for update to authenticated
  using (assigned_to = (select auth.uid()) or private.grievance_visible(category))
  with check (assigned_to = (select auth.uid()) or private.grievance_visible(category));

-- Updates follow the grievance they belong to (grievances RLS applies inside exists).
drop policy "read: participants" on public.grievance_updates;
drop policy "insert: participants" on public.grievance_updates;
create policy "read: participants" on public.grievance_updates for select to authenticated using (
  exists (select 1 from public.grievances g where g.id = grievance_updates.grievance_id));
create policy "insert: participants" on public.grievance_updates for insert to authenticated with check (
  author_id = (select auth.uid())
  and exists (select 1 from public.grievances g where g.id = grievance_updates.grievance_id));

-- ---------- placements ----------
do $$
declare t text;
begin
  foreach t in array array['placement_applications', 'student_skills'] loop
    execute format('drop policy "read: own or staff" on public.%I', t);
    execute format('drop policy "write: staff" on public.%I', t);
    execute format($p$create policy "read: scoped" on public.%I for select to authenticated using (
      student_id = (select private.my_student_id())
      or (select private.has_role('admin', 'placement_officer'))
      or ((select private.has_role('hod')) and student_id in (select private.academic_students())))$p$, t);
    execute format($p$create policy "write: placement cell" on public.%I for all to authenticated
      using ((select private.has_role('admin', 'placement_officer')))
      with check ((select private.has_role('admin', 'placement_officer')))$p$, t);
  end loop;
end $$;

drop policy "read: own or staff" on public.placement_offers;
drop policy "write: staff" on public.placement_offers;
create policy "read: scoped" on public.placement_offers for select to authenticated using (
  exists (select 1 from public.placement_applications a where a.id = placement_offers.application_id));
create policy "write: placement cell" on public.placement_offers for all to authenticated
  using ((select private.has_role('admin', 'placement_officer')))
  with check ((select private.has_role('admin', 'placement_officer')));

do $$
declare t text;
begin
  foreach t in array array['companies', 'placement_drives'] loop
    execute format('drop policy "write: staff" on public.%I', t);
    execute format($p$create policy "write: placement cell" on public.%I for all to authenticated
      using ((select private.has_role('admin', 'placement_officer')))
      with check ((select private.has_role('admin', 'placement_officer')))$p$, t);
  end loop;
end $$;

-- ---------- single-office modules ----------
drop policy "read: own or staff" on public.book_loans;
drop policy "write: staff" on public.book_loans;
create policy "read: own or library" on public.book_loans for select to authenticated using (
  borrower_id = (select auth.uid()) or (select private.has_role('admin', 'librarian')));
create policy "write: library" on public.book_loans for all to authenticated
  using ((select private.has_role('admin', 'librarian'))) with check ((select private.has_role('admin', 'librarian')));

drop policy "read: own or staff" on public.bus_passes;
drop policy "write: staff" on public.bus_passes;
create policy "read: own or transport" on public.bus_passes for select to authenticated using (
  profile_id = (select auth.uid()) or (select private.has_role('admin', 'transport_manager')));
create policy "write: transport" on public.bus_passes for all to authenticated
  using ((select private.has_role('admin', 'transport_manager')))
  with check ((select private.has_role('admin', 'transport_manager')));

do $$
declare
  t text;
  r record;
begin
  for r in select * from (values
      ('visitors', 'admin,security'),
      ('medicine_stock', 'admin,doctor'),
      ('applicants', 'admin'),
      ('expenses', 'admin,accountant'),
      ('inventory_items', 'admin,accountant'),
      ('inventory_movements', 'admin,accountant'),
      ('room_allocation_runs', 'admin,hod')) v(tbl, roles) loop
    execute format('drop policy "all: staff" on public.%I', r.tbl);
    execute format($p$create policy "all: office" on public.%I for all to authenticated
      using ((select private.has_role(variadic %L::public.user_role[])))
      with check ((select private.has_role(variadic %L::public.user_role[])))$p$,
      r.tbl, '{' || r.roles || '}', '{' || r.roles || '}');
  end loop;
end $$;
