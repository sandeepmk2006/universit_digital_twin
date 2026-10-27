-- Read models for the dashboard. All views run with the caller's privileges, so RLS still applies.

create view public.v_dashboard_kpis with (security_invoker = true) as
select
  (select count(*) from public.students where status = 'active')                             as active_students,
  (select count(*) from public.faculty where is_active)                                      as active_faculty,
  (select count(*) from public.rooms)                                                        as rooms,
  (select round(100.0 * count(*) filter (where status in ('present', 'late')) / nullif(count(*), 0), 1)
     from public.attendance_records ar
     join public.attendance_sessions s on s.id = ar.session_id
     join public.course_sections cs on cs.id = s.section_id
     join public.academic_terms t on t.id = cs.term_id and t.is_current)                     as attendance_pct,
  (select count(*) from public.grievances where status in ('open', 'assigned', 'in_progress')) as open_grievances,
  (select count(*) from public.events where starts_at >= now())                              as upcoming_events,
  (select count(*) from public.timetable_slots ts
     join public.course_sections cs on cs.id = ts.section_id
     join public.academic_terms t on t.id = cs.term_id and t.is_current
    where ts.room_id is null)                                                                as unassigned_slots;

create view public.v_department_attendance with (security_invoker = true) as
select d.code as department, d.name,
       round(100.0 * count(*) filter (where ar.status in ('present', 'late')) / nullif(count(*), 0), 1) as attendance_pct
from public.attendance_records ar
join public.attendance_sessions s on s.id = ar.session_id
join public.course_sections cs on cs.id = s.section_id
join public.academic_terms t on t.id = cs.term_id and t.is_current
join public.courses c on c.id = cs.course_id
join public.departments d on d.id = c.department_id
group by d.code, d.name;

create view public.v_student_directory with (security_invoker = true) as
select st.id, st.roll_no, st.full_name, st.email, st.batch_year, st.current_semester, st.cgpa, st.status,
       p.code as program_code, d.code as department,
       att.attendance_pct,
       pr.predicted_gpa, pr.risk_level
from public.students st
join public.programs p on p.id = st.program_id
join public.departments d on d.id = p.department_id
left join lateral (
  select round(100.0 * count(*) filter (where ar.status in ('present', 'late')) / nullif(count(*), 0), 1) as attendance_pct
  from public.attendance_records ar
  join public.attendance_sessions s on s.id = ar.session_id
  join public.course_sections cs on cs.id = s.section_id
  join public.academic_terms t on t.id = cs.term_id and t.is_current
  where ar.student_id = st.id
) att on true
left join lateral (
  select predicted_gpa, risk_level from public.performance_predictions
  where student_id = st.id order by created_at desc limit 1
) pr on true;

create view public.v_section_catalogue with (security_invoker = true) as
select cs.id, c.code, c.title, cs.section, c.semester, c.is_elective, c.requires_lab, d.code as department,
       t.name as term, t.is_current, f.full_name as faculty,
       (select count(*) from public.enrollments e where e.section_id = cs.id) as enrolled, cs.capacity
from public.course_sections cs
join public.courses c on c.id = cs.course_id
join public.departments d on d.id = c.department_id
join public.academic_terms t on t.id = cs.term_id
left join public.faculty f on f.id = cs.faculty_id;

create view public.v_timetable with (security_invoker = true) as
select ts.id, ts.weekday, ts.starts_at, ts.ends_at, ts.room_id, r.code as room, r.capacity as room_capacity,
       sc.id as section_id, sc.code as course_code, sc.title as course_title, sc.section, sc.department,
       sc.semester, sc.faculty, sc.enrolled, sc.is_current
from public.timetable_slots ts
join public.v_section_catalogue sc on sc.id = ts.section_id
left join public.rooms r on r.id = ts.room_id;

create view public.v_invoice_ledger with (security_invoker = true) as
select i.id, st.roll_no, st.full_name, i.amount, i.due_on, i.status,
       coalesce((select sum(p.amount) from public.payments p where p.invoice_id = i.id), 0) as paid,
       coalesce((select sum(s.amount) from public.scholarships s where s.student_id = i.student_id and s.term_id = i.term_id), 0) as scholarship
from public.invoices i
join public.students st on st.id = i.student_id;

create view public.v_placement_funnel with (security_invoker = true) as
select dr.id, c.name as company, dr.role_title, dr.package_lpa, dr.drive_date, dr.status,
       count(a.id)                                     as applied,
       count(a.id) filter (where a.stage <> 'applied' and a.stage <> 'rejected') as progressed,
       count(a.id) filter (where a.stage = 'offered')  as offers
from public.placement_drives dr
join public.companies c on c.id = dr.company_id
left join public.placement_applications a on a.drive_id = dr.id
group by dr.id, c.name;

create view public.v_library_loans with (security_invoker = true) as
select l.id, b.title, bc.barcode, pr.full_name as borrower, l.issued_on, l.due_on, l.returned_on, l.fine_amount,
       case when l.returned_on is not null then 'returned'
            when l.due_on < current_date then 'overdue' else 'issued' end as state
from public.book_loans l
join public.book_copies bc on bc.id = l.copy_id
join public.books b on b.id = bc.book_id
join public.profiles pr on pr.id = l.borrower_id;
