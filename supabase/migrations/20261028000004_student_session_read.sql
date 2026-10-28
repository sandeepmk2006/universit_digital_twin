-- Students need the date and hour of the class sessions they attend to build their
-- hour-wise attendance view. Allow reading only sessions of sections they are
-- enrolled in; staff keep full access through the existing policy.

create policy "read: enrolled student" on public.attendance_sessions for select to authenticated
  using (exists (
    select 1 from public.enrollments e
    where e.section_id = attendance_sessions.section_id
      and e.student_id = (select private.my_student_id())
  ));
