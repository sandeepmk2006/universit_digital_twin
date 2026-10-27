-- Admissions, placements, research, alumni, finance, inventory, grievances, feedback, knowledge base.

select setseed(0.7);

-- Admissions for the 2027 intake
insert into public.applicants (full_name, email, phone, program_id, entrance_score, board_percentage, category, status, applied_at)
select 'Applicant ' || n, 'applicant' || n || '@mail.example', '9' || lpad((n * 104729 % 999999999)::text, 9, '0'),
       p.id, round((40 + random() * 160)::numeric, 2), round((60 + random() * 39)::numeric, 2),
       (array['GM', 'OBC', 'SC', 'ST', 'EWS'])[1 + n % 5],
       (array['submitted', 'submitted', 'shortlisted', 'offered', 'accepted', 'rejected', 'withdrawn'])[1 + (random() * 6)::int],
       timestamptz '2026-09-01' + (random() * 55 || ' days')::interval
from generate_series(1, 1500) n
join (select id, row_number() over (order by code) - 1 as k from public.programs) p on p.k = n % 6;

-- Placements
insert into public.companies (name, sector, website) values
  ('Infosys', 'IT services', 'https://www.infosys.com'), ('TCS', 'IT services', 'https://www.tcs.com'),
  ('Wipro', 'IT services', 'https://www.wipro.com'), ('Accenture', 'Consulting', 'https://www.accenture.com'),
  ('Bosch', 'Automotive', 'https://www.bosch.in'), ('Siemens', 'Industrial', 'https://www.siemens.com'),
  ('Texas Instruments', 'Semiconductors', 'https://www.ti.com'), ('Qualcomm', 'Semiconductors', 'https://www.qualcomm.com'),
  ('L&T Construction', 'Construction', 'https://www.larsentoubro.com'), ('Tata Motors', 'Automotive', 'https://www.tatamotors.com'),
  ('Deloitte', 'Consulting', 'https://www.deloitte.com'), ('HDFC Bank', 'Banking', 'https://www.hdfcbank.com'),
  ('Flipkart', 'E-commerce', 'https://www.flipkart.com'), ('Zoho', 'Software', 'https://www.zoho.com'),
  ('ABB', 'Power', 'https://new.abb.com');

insert into public.placement_drives (company_id, role_title, package_lpa, min_cgpa, required_skills, eligible_programs, drive_date, status)
select c.id, d.role, d.pkg, d.cgpa, d.skills,
       array(select p.id from public.programs p join public.departments dp on dp.id = p.department_id where dp.code = any(d.depts)),
       d.dt::date, case when d.dt::date < date '2026-10-27' then 'completed' else 'upcoming' end
from (values
  ('Infosys', 'Systems Engineer', 4.5, 6.0, array['programming','sql','communication'], array['CSE','ECE','EEE','MECH','CIVIL'], '2026-08-20'),
  ('TCS', 'Digital Engineer', 7.0, 7.0, array['programming','data structures','sql'], array['CSE','ECE','EEE'], '2026-09-05'),
  ('Accenture', 'Associate Software Engineer', 6.5, 6.5, array['programming','communication','cloud'], array['CSE','ECE','EEE','MECH'], '2026-09-18'),
  ('Bosch', 'Graduate Engineer Trainee', 7.5, 7.0, array['embedded c','matlab','control systems'], array['ECE','EEE','MECH'], '2026-10-08'),
  ('Texas Instruments', 'Analog Design Engineer', 18.0, 8.0, array['analog circuits','vlsi','matlab'], array['ECE','EEE'], '2026-11-05'),
  ('Qualcomm', 'Software Engineer', 22.0, 8.0, array['c++','data structures','operating systems'], array['CSE','ECE'], '2026-11-12'),
  ('L&T Construction', 'Graduate Engineer Trainee', 6.0, 6.5, array['autocad','structural design','site management'], array['CIVIL','MECH'], '2026-11-18'),
  ('Tata Motors', 'Design Engineer', 7.2, 7.0, array['catia','autocad','thermodynamics'], array['MECH'], '2026-11-25'),
  ('Deloitte', 'Business Analyst', 9.0, 7.0, array['sql','excel','communication','analytics'], array['CSE','MBA'], '2026-12-02'),
  ('HDFC Bank', 'Management Trainee', 8.0, 6.5, array['finance','excel','communication'], array['MBA'], '2026-11-28'),
  ('Flipkart', 'SDE-1', 28.0, 8.5, array['data structures','system design','java'], array['CSE'], '2026-12-08'),
  ('Zoho', 'Member Technical Staff', 8.4, 6.0, array['programming','data structures'], array['CSE','ECE'], '2026-10-15'),
  ('ABB', 'Power Systems Engineer', 7.8, 7.0, array['power systems','matlab','plc'], array['EEE'], '2026-12-10'),
  ('Siemens', 'Automation Engineer', 8.0, 7.0, array['plc','control systems','embedded c'], array['EEE','ECE','MECH'], '2026-11-20'),
  ('Wipro', 'Project Engineer', 3.5, 6.0, array['programming','communication'], array['CSE','ECE','EEE','MECH','CIVIL'], '2026-08-28')
) d(company, role, pkg, cgpa, skills, depts, dt)
join public.companies c on c.name = d.company;

insert into public.student_skills (student_id, skill, level)
select st.id, s.skill, 1 + (random() * 4)::int
from public.students st
join public.programs p on p.id = st.program_id
join public.departments d on d.id = p.department_id
cross join lateral (
  select skill from unnest(case d.code
    when 'CSE'   then array['programming','data structures','sql','java','c++','cloud','system design','operating systems','communication']
    when 'ECE'   then array['embedded c','vlsi','matlab','analog circuits','programming','c++','communication']
    when 'EEE'   then array['matlab','power systems','plc','control systems','embedded c','communication']
    when 'MECH'  then array['autocad','catia','thermodynamics','matlab','communication']
    when 'CIVIL' then array['autocad','structural design','site management','communication']
    else array['excel','finance','analytics','communication','sql'] end) skill
  where abs(hashtext(st.roll_no || skill)) % 100 < 55
) s
where st.current_semester >= 5 or d.code = 'MBA';

insert into public.placement_applications (drive_id, student_id, stage, updated_at)
select dr.id, st.id,
       case when dr.status = 'upcoming' then 'applied'
            when st.cgpa >= dr.min_cgpa + 1.2 and random() < 0.55 then 'offered'
            when random() < 0.5 then 'rejected'
            else (array['shortlisted', 'test', 'interview'])[1 + (random() * 2)::int] end,
       dr.drive_date
from public.placement_drives dr
join public.students st on st.program_id = any(dr.eligible_programs)
where st.cgpa >= dr.min_cgpa and (st.current_semester = 7 or (st.current_semester = 3 and st.batch_year = 2025))
  and random() < 0.6;

insert into public.placement_offers (application_id, package_lpa, offered_on, accepted)
select a.id, dr.package_lpa, dr.drive_date + 7, random() < 0.85
from public.placement_applications a join public.placement_drives dr on dr.id = a.drive_id
where a.stage = 'offered';

-- Research
insert into public.research_projects (title, lead_faculty_id, funding_agency, grant_amount, starts_on, ends_on, status)
select r.title, (select f.id from public.faculty f join public.departments d on d.id = f.department_id
                  where d.code = r.dept order by f.employee_no offset r.k limit 1),
       r.agency, r.amount, r.starts::date, r.ends::date, r.status
from (values
  ('Federated learning for campus health records', 'CSE', 1, 'DST-SERB', 2850000, '2025-04-01', '2028-03-31', 'active'),
  ('Low-power LoRa sensor mesh for smart agriculture', 'ECE', 2, 'MeitY', 1920000, '2024-10-01', '2027-09-30', 'active'),
  ('Grid-forming inverters for rural microgrids', 'EEE', 1, 'DST', 3400000, '2025-01-01', '2027-12-31', 'active'),
  ('Additively manufactured lattice heat sinks', 'MECH', 3, 'AICTE RPS', 1100000, '2024-06-01', '2026-05-31', 'completed'),
  ('Recycled aggregate concrete for low-cost housing', 'CIVIL', 2, 'Karnataka State Council for S&T', 760000, '2025-07-01', '2027-06-30', 'active'),
  ('Vision-based crack detection on bridges', 'CIVIL', 4, 'NHAI', 2400000, '2026-01-15', '2028-01-14', 'active'),
  ('Explainable credit scoring for MSMEs', 'MBA', 1, 'ICSSR', 650000, '2025-09-01', '2027-08-31', 'active'),
  ('Code-mixed Kannada-English speech recognition', 'CSE', 3, 'Industry: Zoho', 1500000, '2026-03-01', null, 'proposed')
) r(title, dept, k, agency, amount, starts, ends, status);

insert into public.publications (title, venue, kind, year, doi, project_id)
select p.title, p.venue, p.kind, p.year, p.doi, (select id from public.research_projects where title = p.project)
from (values
  ('Privacy-preserving gradient aggregation for small hospitals', 'IEEE Access', 'journal', 2026, '10.1109/ACCESS.2026.000101', 'Federated learning for campus health records'),
  ('An energy model for duty-cycled LoRa meshes', 'IEEE Sensors Journal', 'journal', 2025, '10.1109/JSEN.2025.000202', 'Low-power LoRa sensor mesh for smart agriculture'),
  ('Virtual synchronous control in weak grids', 'IEEE PES General Meeting', 'conference', 2026, '10.1109/PESGM.2026.000303', 'Grid-forming inverters for rural microgrids'),
  ('Gyroid lattice heat sinks by laser powder bed fusion', 'Applied Thermal Engineering', 'journal', 2026, '10.1016/j.applthermaleng.2026.000404', 'Additively manufactured lattice heat sinks'),
  ('Durability of recycled aggregate concrete under wet-dry cycles', 'Construction and Building Materials', 'journal', 2026, '10.1016/j.conbuildmat.2026.000505', 'Recycled aggregate concrete for low-cost housing'),
  ('Segmenting hairline cracks with lightweight U-Nets', 'WACV Workshops', 'conference', 2026, '10.1109/WACVW.2026.000606', 'Vision-based crack detection on bridges'),
  ('Lattice heat sink with graded porosity', 'Indian Patent Office', 'patent', 2026, null, 'Additively manufactured lattice heat sinks')
) p(title, venue, kind, year, doi, project);

insert into public.publication_authors (publication_id, faculty_id, position)
select pb.id, rp.lead_faculty_id, 1 from public.publications pb join public.research_projects rp on rp.id = pb.project_id;

insert into public.publication_authors (publication_id, student_id, position)
select pb.id, (select st.id from public.students st where st.current_semester = 7 order by abs(hashtext(st.roll_no || pb.title)) limit 1), 2
from public.publications pb;

-- Alumni (graduated batches, not in the students table)
insert into public.alumni (full_name, graduation_year, program_id, current_company, job_title, city, open_to_mentor)
select 'Alumnus ' || n, 2015 + n % 11, p.id, c.name,
       (array['Software Engineer', 'Senior Engineer', 'Product Manager', 'Design Engineer', 'Analyst', 'Founder', 'Consultant'])[1 + n % 7],
       (array['Bengaluru', 'Hyderabad', 'Pune', 'Chennai', 'Mumbai', 'Seattle', 'Berlin', 'Singapore'])[1 + n % 8],
       n % 4 = 0
from generate_series(1, 400) n
join (select id, row_number() over (order by code) - 1 as k from public.programs) p on p.k = n % 6
join (select name, row_number() over (order by name) - 1 as k from public.companies) c on c.k = n % 15;

-- Finance
insert into public.fee_structures (program_id, term_id, component, amount)
select p.id, t.id, f.component, f.amount * case when p.code = 'MBA' then 1.4 else 1 end
from public.programs p
cross join public.academic_terms t
cross join (values ('tuition', 95000), ('exam', 3500), ('library', 2000), ('lab', 6000)) f(component, amount)
where t.is_current;

insert into public.invoices (student_id, term_id, amount, due_on, status)
select st.id, t.id,
       (select sum(amount) from public.fee_structures fs where fs.program_id = st.program_id and fs.term_id = t.id)
       + case when exists (select 1 from public.hostel_allocations ha where ha.student_id = st.id) then 62000 else 0 end
       + case when exists (select 1 from public.bus_passes bp where bp.profile_id = st.profile_id) then 14000 else 0 end,
       date '2026-08-14',
       'unpaid'
from public.students st cross join public.academic_terms t where t.is_current;

insert into public.scholarships (student_id, name, amount, term_id)
select st.id, case when st.cgpa >= 9.2 then 'Merit Scholarship' else 'Need-based Fee Waiver' end,
       case when st.cgpa >= 9.2 then 50000 else 30000 end, t.id
from public.students st cross join public.academic_terms t
where t.is_current and (st.cgpa >= 9.2 or abs(hashtext(st.roll_no || 'need')) % 100 < 4);

with plan as (
  select i.id, i.amount - coalesce((select sum(s.amount) from public.scholarships s where s.student_id = i.student_id and s.term_id = i.term_id), 0) as payable,
         random() as r
  from public.invoices i
)
insert into public.payments (invoice_id, amount, method, reference, paid_at)
select id, case when r < 0.82 then payable else round(payable * 0.5) end,
       (array['upi', 'netbanking', 'card', 'cheque'])[1 + (abs(hashtext(id::text)) % 4)],
       'TXN' || upper(substr(md5(id::text), 1, 12)),
       timestamptz '2026-07-25' + (random() * 25 || ' days')::interval
from plan where r < 0.93 and payable > 0;

update public.invoices i
set status = case
  when coalesce(p.paid, 0) + coalesce(s.amt, 0) >= i.amount then 'paid'
  when coalesce(p.paid, 0) > 0 then 'partial'
  else 'unpaid' end
from public.invoices i2
left join (select invoice_id, sum(amount) paid from public.payments group by 1) p on p.invoice_id = i2.id
left join (select student_id, term_id, sum(amount) amt from public.scholarships group by 1, 2) s on s.student_id = i2.student_id and s.term_id = i2.term_id
where i.id = i2.id;

insert into public.expenses (department_id, category, amount, spent_on, notes)
select d.id, e.category, round((e.base * (0.6 + random() * 0.8))::numeric, 2), date '2026-07-01' + (m * 30 + (random() * 25)::int), e.note
from public.departments d
cross join generate_series(0, 3) m
cross join (values ('lab consumables', 85000, 'Monthly lab consumables'), ('equipment', 240000, 'Equipment purchase'),
                   ('events', 45000, 'Department events and guest lectures'), ('maintenance', 60000, 'Classroom and lab maintenance')) e(category, base, note);

-- Inventory
insert into public.inventory_items (sku, name, category, unit, quantity, reorder_at, room_id)
select i.sku, i.name, i.category, i.unit, i.qty, i.reorder, (select id from public.rooms where code = i.room)
from (values
  ('IT-DT-001', 'Desktop computer (i5, 16GB)', 'IT', 'pcs', 720, 20, null),
  ('IT-PRJ-002', 'Ceiling projector', 'IT', 'pcs', 74, 5, null),
  ('IT-SW-003', 'Network switch 48-port', 'IT', 'pcs', 18, 2, null),
  ('LAB-OSC-001', 'Digital storage oscilloscope', 'Electronics lab', 'pcs', 46, 4, 'TB-L05'),
  ('LAB-FG-002', 'Function generator', 'Electronics lab', 'pcs', 52, 4, 'TB-L05'),
  ('LAB-MM-003', 'Digital multimeter', 'Electronics lab', 'pcs', 140, 20, 'TB-L06'),
  ('LAB-ARD-004', 'Arduino Uno board', 'Electronics lab', 'pcs', 35, 40, 'TB-L07'),
  ('LAB-UTM-005', 'Universal testing machine', 'Civil lab', 'pcs', 2, 0, 'TB-L12'),
  ('FUR-CH-001', 'Student chair', 'Furniture', 'pcs', 5200, 100, null),
  ('FUR-DK-002', 'Student desk (2-seater)', 'Furniture', 'pcs', 2500, 50, null),
  ('STA-A4-001', 'A4 paper ream', 'Stationery', 'ream', 180, 200, null),
  ('STA-MK-002', 'Whiteboard marker', 'Stationery', 'box', 64, 50, null)
) i(sku, name, category, unit, qty, reorder, room);

insert into public.inventory_movements (item_id, delta, reason, moved_by, moved_at)
select it.id, case when k % 3 = 0 then 10 + (random() * 40)::int else -(1 + (random() * 8)::int) end,
       case when k % 3 = 0 then 'purchase' else 'issued' end,
       (select id from public.profiles where email = 'admin@edubase.edu'),
       timestamptz '2026-07-01' + (k * 9 || ' days')::interval
from public.inventory_items it cross join generate_series(1, 12) k;

-- Grievances
insert into public.grievances (raised_by, category, subject, details, is_anonymous, status, assigned_to, created_at, resolved_at)
select st.profile_id, g.category, g.subject, g.details, g.anon,
       g.status, case when g.status <> 'open' then (select id from public.profiles where email = 'admin@edubase.edu') end,
       g.created, case when g.status in ('resolved', 'closed') then g.created + interval '6 days' end
from (values
  (0, 'academic', 'Internal marks not updated', 'Internal 1 marks for my elective are missing on the portal.', false, 'resolved', timestamptz '2026-09-04'),
  (1, 'transport', 'Bus R3 consistently late', 'Route R3 reaches campus after 9:15 most days, so we miss the first period.', false, 'in_progress', timestamptz '2026-10-06'),
  (2, 'hostel', 'Hot water unavailable', 'No hot water in Kaveri Hall block B for a week.', false, 'assigned', timestamptz '2026-10-19'),
  (3, 'finance', 'Scholarship amount not adjusted', 'Fee invoice does not reflect the merit scholarship.', false, 'open', timestamptz '2026-10-22'),
  (4, 'infrastructure', 'Projector broken in AB1-204', 'Projector has not worked for two weeks.', false, 'resolved', timestamptz '2026-09-12'),
  (5, 'harassment', 'Ragging complaint', 'Seniors in the hostel are forcing first-years to run errands at night.', true, 'in_progress', timestamptz '2026-08-11'),
  (6, 'academic', 'Timetable clash', 'Two of my courses are scheduled at the same time on Wednesday.', false, 'open', timestamptz '2026-10-24'),
  (7, 'infrastructure', 'Wi-Fi coverage in library', 'Second floor of the library has no Wi-Fi signal.', false, 'closed', timestamptz '2026-08-20'),
  (8, 'other', 'Canteen hygiene', 'Plates are not washed properly in the main canteen.', false, 'assigned', timestamptz '2026-10-14'),
  (9, 'academic', 'Request for re-evaluation', 'Requesting re-evaluation of the Data Structures internal 2 paper.', false, 'open', timestamptz '2026-10-25')
) g(k, category, subject, details, anon, status, created)
join (select profile_id, row_number() over (order by roll_no) - 1 as k from public.students where current_semester >= 3) st on st.k = g.k * 97;

insert into public.grievance_updates (grievance_id, author_id, note, created_at)
select g.id, g.assigned_to, n.note, g.created_at + interval '1 day'
from public.grievances g
join (values ('assigned', 'Forwarded to the concerned department.'), ('in_progress', 'Department has acknowledged and is working on it.'),
             ('resolved', 'Issue fixed. Please reopen if it happens again.'), ('closed', 'Resolved and confirmed by the student.')) n(status, note)
  on n.status = g.status
where g.assigned_to is not null;

-- Feedback
insert into public.feedback_forms (title, section_id, questions, opens_at, closes_at)
select 'Mid-term course feedback: ' || c.code || ' ' || cs.section, cs.id,
       '[{"id":"q1","text":"The instructor explains concepts clearly","type":"rating"},
         {"id":"q2","text":"The pace of the course is appropriate","type":"rating"},
         {"id":"q3","text":"Assignments help me learn","type":"rating"},
         {"id":"q4","text":"What should change in the second half?","type":"text"}]'::jsonb,
       '2026-09-20', '2026-10-05'
from public.course_sections cs join public.courses c on c.id = cs.course_id
join public.academic_terms t on t.id = cs.term_id and t.is_current;

insert into public.feedback_responses (form_id, respondent_id, answers, submitted_at)
select f.id, st.profile_id,
       jsonb_build_object('q1', r1, 'q2', least(5, greatest(1, r1 + (random() * 2)::int - 1)), 'q3', 2 + (random() * 3)::int,
                          'q4', (array['More worked examples', 'Slower pace please', 'More lab time', 'Nothing, going well', ''])[1 + (random() * 4)::int]),
       f.opens_at + (random() * 14 || ' days')::interval
from public.feedback_forms f
join public.enrollments e on e.section_id = f.section_id
join public.students st on st.id = e.student_id
cross join lateral (select 2 + (abs(hashtext(f.section_id::text)) % 3) + (random() * 1.2)::int as r1) x
where random() < 0.45;

-- Knowledge base for the campus assistant
insert into public.kb_documents (source, title, content) values
  ('policy', 'Attendance requirement', 'Students must maintain at least 75% attendance in every course to be eligible for the end-semester examination. Attendance between 65% and 75% can be condoned by the Dean on medical grounds with a certificate from the Health Centre submitted within 7 days of returning. Below 65% the student must repeat the course.'),
  ('policy', 'Internal assessment scheme', 'Each course has two internal tests of 50 marks (15% weight each), an assignment of 20 marks (10%), a lab component of 50 marks (10%) for lab courses, and an end-semester examination of 100 marks (50%). Grades: O >= 90, A+ >= 80, A >= 70, B+ >= 60, B >= 50, C >= 40, F below 40.'),
  ('policy', 'Re-evaluation', 'Students can apply for re-evaluation of an internal test within 5 working days of marks being published, through the Grievances module under category academic. The fee for end-semester re-evaluation is Rs 500 per paper.'),
  ('handbook', 'Library rules', 'The Central Library is open 8:00 to 22:00 on weekdays and 9:00 to 17:00 on Saturdays. Students can borrow up to 4 books for 14 days. Late returns are fined Rs 5 per book per day. Reference books cannot be issued.'),
  ('handbook', 'Hostel rules', 'Hostel gates close at 22:00. Mess timings: breakfast 7:00-9:00, lunch 12:15-14:00, dinner 19:30-21:30. Complaints about rooms, water, electricity or Wi-Fi are raised in the Hostel module and handled by the warden within 72 hours.'),
  ('handbook', 'Transport', 'College buses run on six routes (R1 Majestic, R2 Whitefield, R3 Electronic City, R4 Yelahanka, R5 Banashankari, R6 Hebbal). The first pickup is at 7:08 and buses reach campus by 8:45. Return trips leave campus at 16:45 and 17:45. The bus pass costs Rs 14,000 per term.'),
  ('handbook', 'Health Centre', 'The Health Centre in the Management Block ground floor is open 8:30 to 20:00 on all days with a doctor on call at night. Emergency number: 080-4000-1111. Medical certificates for attendance condonation are issued here.'),
  ('handbook', 'Fees and scholarships', 'Fees for the odd term are due by 14 August. A merit scholarship of Rs 50,000 is awarded to students with CGPA 9.2 or above. Need-based fee waivers are available on application to the Accounts Section. Payments accepted by UPI, net banking, card and cheque.'),
  ('policy', 'Anti-ragging', 'Ragging in any form is a criminal offence. Complaints can be filed anonymously in the Grievances module under category harassment, or by calling the anti-ragging helpline 1800-180-5522. All complaints are investigated within 24 hours.'),
  ('handbook', 'Placement process', 'Students in the final year with no active backlogs are eligible for campus placements. Each drive lists a minimum CGPA and eligible programmes. A student who accepts an offer above 10 LPA cannot apply to further drives. Mock tests are held by the Placement Cell every Saturday.'),
  ('calendar', 'Academic calendar 2026 Odd term', 'Classes began on 20 July 2026. Internal test 1: 28 August. Internal test 2: 16 October. Last working day: 27 November. End-semester examinations: 1-11 December 2026. The even term begins on 4 January 2027.'),
  ('handbook', 'Sports facilities', 'The cricket ground, football field, badminton hall, basketball court, swimming pool, gymnasium and table tennis room can be booked in 90-minute slots between 6:00 and 20:00 through the Sports module. The swimming pool is closed on Mondays.');

drop table private.seed_students;
analyze;
