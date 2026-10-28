-- Karunya's assessment scheme (out of 100):
--   three internal tests of 40 marks, each converted to 15        45
--   assignment (lab record for lab courses), converted to         10
--   attendance: >=95% 5, >=90% 4, >=85% 3, >=80% 2, below 80% 1    5
--   end-semester examination of 100 marks, converted to           40
alter table public.exams drop constraint exams_kind_check;
alter table public.exams add constraint exams_kind_check
  check (kind in ('internal_1', 'internal_2', 'internal_3', 'assignment', 'lab', 'end_semester'));

-- Attendance component of the internal marks.
create or replace function public.attendance_marks(pct numeric) returns smallint
language sql immutable set search_path = '' as $$
  select case when pct >= 95 then 5 when pct >= 90 then 4 when pct >= 85 then 3
              when pct >= 80 then 2 else 1 end::smallint
$$;
