-- Re-shape assessments to Karunya's scheme: internal tests out of 40 (converted to 15),
-- a third internal test, assignment converted to 10, end semester converted to 40.
update public.marks m set obtained = round(m.obtained * 0.8 * 2) / 2
from public.exams e
where e.id = m.exam_id and e.kind in ('internal_1', 'internal_2') and e.max_marks = 50;
update public.exams set max_marks = 40, weightage = 15 where kind in ('internal_1', 'internal_2');
update public.exams set weightage = 10 where kind = 'assignment';
update public.exams set weightage = 40 where kind = 'end_semester';
update public.exams set weightage = 0 where kind = 'lab';  -- lab record marks feed the lab course, not this scheme

-- Third internal test: finished last semester, scheduled for 13 Nov in the current one.
insert into public.exams (section_id, kind, max_marks, weightage, held_on)
select e.section_id, 'internal_3', 40, 15,
       case when t.is_current then date '2026-11-13' else date '2026-05-02' end
from public.exams e
join public.course_sections cs on cs.id = e.section_id
join public.academic_terms t on t.id = cs.term_id
where e.kind = 'internal_2'
  and not exists (select 1 from public.exams x where x.section_id = e.section_id and x.kind = 'internal_3');

-- Past-semester third-test marks track each student's first two tests.
insert into public.marks (exam_id, student_id, obtained)
select e3.id, m.student_id,
       least(40, greatest(0, round((avg(m.obtained) + (random() * 8 - 4)) * 2) / 2))
from public.exams e3
join public.academic_terms t on t.id = (select term_id from public.course_sections where id = e3.section_id)
join public.exams e on e.section_id = e3.section_id and e.kind in ('internal_1', 'internal_2')
join public.marks m on m.exam_id = e.id
where e3.kind = 'internal_3' and not t.is_current
  and not exists (select 1 from public.marks x where x.exam_id = e3.id)
group by e3.id, m.student_id;
