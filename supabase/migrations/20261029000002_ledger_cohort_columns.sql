-- Lists are split by year of study and department, so the fee ledger carries both.
create or replace view public.v_invoice_ledger with (security_invoker = true) as
select i.id,
       st.roll_no,
       st.full_name,
       i.amount,
       i.due_on,
       i.status,
       coalesce((select sum(p.amount) from public.payments p where p.invoice_id = i.id), 0) as paid,
       coalesce((select sum(s.amount) from public.scholarships s
                 where s.student_id = i.student_id and s.term_id = i.term_id), 0) as scholarship,
       st.current_semester,
       d.code as department
from public.invoices i
join public.students st on st.id = i.student_id
join public.programs pr on pr.id = st.program_id
join public.departments d on d.id = pr.department_id;
