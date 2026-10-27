-- Convert student registration numbers to the Karunya-style format,
-- e.g. 23CSE001 -> URK23CS1001  (URK + 2-digit batch + 2-letter dept + 4-digit serial).
-- Login emails are kept as-is; the reg number is a separate identifier.
-- Idempotent: rows already in URK form are skipped.

update public.students st
set roll_no = 'URK' || right(st.batch_year::text, 2) || dc.c2 ||
              lpad((1000 + substring(st.roll_no from '([0-9]{3})$')::int)::text, 4, '0')
from public.programs p, public.departments d,
     (values ('CSE','CS'),('ECE','EC'),('EEE','EE'),('MECH','ME'),('CIVIL','CE'),('MBA','MB')) dc(code, c2)
where p.id = st.program_id and d.id = p.department_id and dc.code = d.code
  and st.roll_no !~ '^URK';
