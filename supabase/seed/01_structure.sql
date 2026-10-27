-- Departments, programmes, campus, terms and the course catalogue.

insert into public.departments (code, name) values
  ('CSE',  'Computer Science and Engineering'),
  ('ECE',  'Electronics and Communication Engineering'),
  ('EEE',  'Electrical and Electronics Engineering'),
  ('MECH', 'Mechanical Engineering'),
  ('CIVIL','Civil Engineering'),
  ('MBA',  'School of Management');

insert into public.programs (department_id, code, name, degree, duration_years)
select id,
       case when code = 'MBA' then 'MBA' else 'BT-' || code end,
       case when code = 'MBA' then 'Master of Business Administration' else 'B.Tech ' || name end,
       case when code = 'MBA' then 'MBA' else 'B.Tech' end,
       case when code = 'MBA' then 2 else 4 end
from public.departments;

insert into public.academic_terms (name, starts_on, ends_on, is_current) values
  ('2025 Odd',  '2025-07-21', '2025-12-12', false),
  ('2026 Even', '2026-01-05', '2026-05-22', false),
  ('2026 Odd',  '2026-07-20', '2026-12-11', true);

insert into public.buildings (code, name, floors) values
  ('AB1', 'Academic Block 1', 5),
  ('AB2', 'Academic Block 2', 5),
  ('TB',  'Technology Block', 4),
  ('MB',  'Management Block', 3),
  ('CC',  'Convention Centre', 2);

-- 64 classrooms, 24 labs, 4 seminar halls, 1 auditorium.
insert into public.rooms (building_id, code, kind, capacity, floor, equipment)
select b.id,
       b.code || '-' || (f * 100 + n),
       'classroom',
       (array[40, 60, 60, 72, 90, 120])[1 + (f + n) % 6],
       f,
       case when n % 3 = 0 then array['projector', 'smart_board'] else array['projector'] end
from public.buildings b
cross join generate_series(1, 4) f
cross join generate_series(1, 8) n
where b.code in ('AB1', 'AB2');

insert into public.rooms (building_id, code, kind, capacity, floor, equipment)
select b.id, 'TB-L' || lpad(n::text, 2, '0'), 'lab',
       (array[30, 36, 40, 60])[1 + n % 4], (n - 1) / 6,
       array['computers', 'projector']
from public.buildings b cross join generate_series(1, 24) n
where b.code = 'TB';

insert into public.rooms (building_id, code, kind, capacity, floor, equipment)
select b.id, 'MB-S' || n, 'seminar_hall', 150, n - 1, array['projector', 'audio']
from public.buildings b cross join generate_series(1, 4) n where b.code = 'MB';

insert into public.rooms (building_id, code, kind, capacity, floor, equipment)
select id, 'CC-AUD', 'auditorium', 800, 0, array['projector', 'audio', 'stage'] from public.buildings where code = 'CC';

-- Course catalogue: per department, 8 semesters (4 for MBA); 5 core courses each,
-- and 3 electives per semester from semester 5 (semester 2 for MBA).
create temporary table course_names (dept text, sem int, slot int, title text, tags text[], lab boolean, elective boolean);

insert into course_names values
  ('CSE',1,1,'Programming in C',            '{programming,fundamentals}',true,false),
  ('CSE',1,2,'Engineering Mathematics I',   '{mathematics}',false,false),
  ('CSE',1,3,'Engineering Physics',         '{physics}',true,false),
  ('CSE',1,4,'Basic Electrical Engineering','{electrical}',false,false),
  ('CSE',1,5,'Communicative English',       '{communication}',false,false),
  ('CSE',3,1,'Data Structures',             '{programming,algorithms}',true,false),
  ('CSE',3,2,'Discrete Mathematics',        '{mathematics,theory}',false,false),
  ('CSE',3,3,'Digital Logic Design',        '{hardware,electronics}',true,false),
  ('CSE',3,4,'Object Oriented Programming', '{programming,java}',true,false),
  ('CSE',3,5,'Probability and Statistics',  '{mathematics,data}',false,false),
  ('CSE',5,1,'Operating Systems',           '{systems}',true,false),
  ('CSE',5,2,'Database Management Systems', '{data,databases}',true,false),
  ('CSE',5,3,'Computer Networks',           '{networks,systems}',false,false),
  ('CSE',5,4,'Theory of Computation',       '{theory}',false,false),
  ('CSE',5,5,'Software Engineering',        '{software,process}',false,false),
  ('CSE',5,6,'Machine Learning',            '{ai,data,python}',true,true),
  ('CSE',5,7,'Web Technologies',            '{web,programming}',true,true),
  ('CSE',5,8,'Computer Graphics',           '{graphics,mathematics}',true,true),
  ('CSE',7,1,'Compiler Design',             '{theory,systems}',false,false),
  ('CSE',7,2,'Cloud Computing',             '{cloud,systems}',true,false),
  ('CSE',7,3,'Information Security',        '{security,networks}',false,false),
  ('CSE',7,4,'Project Phase I',             '{project}',false,false),
  ('CSE',7,5,'Professional Ethics',         '{humanities}',false,false),
  ('CSE',7,6,'Deep Learning',               '{ai,data,python}',true,true),
  ('CSE',7,7,'Blockchain Technologies',     '{security,distributed}',false,true),
  ('CSE',7,8,'Natural Language Processing', '{ai,language,python}',true,true),
  ('ECE',1,1,'Programming in C',            '{programming,fundamentals}',true,false),
  ('ECE',1,2,'Engineering Mathematics I',   '{mathematics}',false,false),
  ('ECE',1,3,'Engineering Chemistry',       '{chemistry}',true,false),
  ('ECE',1,4,'Basic Electronics',           '{electronics}',true,false),
  ('ECE',1,5,'Communicative English',       '{communication}',false,false),
  ('ECE',3,1,'Electronic Devices',          '{electronics}',true,false),
  ('ECE',3,2,'Signals and Systems',         '{signals,mathematics}',false,false),
  ('ECE',3,3,'Network Analysis',            '{circuits}',false,false),
  ('ECE',3,4,'Digital Electronics',         '{electronics,hardware}',true,false),
  ('ECE',3,5,'Engineering Mathematics III', '{mathematics}',false,false),
  ('ECE',5,1,'Analog Communication',        '{communication_systems}',true,false),
  ('ECE',5,2,'Microprocessors',             '{hardware,embedded}',true,false),
  ('ECE',5,3,'Control Systems',             '{control}',false,false),
  ('ECE',5,4,'Electromagnetic Fields',      '{physics,electromagnetics}',false,false),
  ('ECE',5,5,'Linear Integrated Circuits',  '{circuits}',true,false),
  ('ECE',5,6,'Embedded Systems',            '{embedded,programming}',true,true),
  ('ECE',5,7,'Digital Signal Processing',   '{signals,data}',true,true),
  ('ECE',5,8,'Internet of Things',          '{embedded,networks}',true,true),
  ('ECE',7,1,'VLSI Design',                 '{hardware,vlsi}',true,false),
  ('ECE',7,2,'Wireless Communication',      '{communication_systems,networks}',false,false),
  ('ECE',7,3,'Antennas and Wave Propagation','{electromagnetics}',false,false),
  ('ECE',7,4,'Project Phase I',             '{project}',false,false),
  ('ECE',7,5,'Professional Ethics',         '{humanities}',false,false),
  ('ECE',7,6,'Machine Learning for Signals','{ai,signals,python}',true,true),
  ('ECE',7,7,'Robotics',                    '{embedded,control}',true,true),
  ('ECE',7,8,'Satellite Communication',     '{communication_systems}',false,true),
  ('EEE',1,1,'Programming in C',            '{programming,fundamentals}',true,false),
  ('EEE',1,2,'Engineering Mathematics I',   '{mathematics}',false,false),
  ('EEE',1,3,'Engineering Physics',         '{physics}',true,false),
  ('EEE',1,4,'Basic Electrical Engineering','{electrical}',true,false),
  ('EEE',1,5,'Communicative English',       '{communication}',false,false),
  ('EEE',3,1,'Electric Circuit Analysis',   '{circuits}',true,false),
  ('EEE',3,2,'Electrical Machines I',       '{machines}',true,false),
  ('EEE',3,3,'Electromagnetic Theory',      '{electromagnetics}',false,false),
  ('EEE',3,4,'Analog Electronics',          '{electronics}',true,false),
  ('EEE',3,5,'Engineering Mathematics III', '{mathematics}',false,false),
  ('EEE',5,1,'Power Systems I',             '{power}',false,false),
  ('EEE',5,2,'Electrical Machines II',      '{machines}',true,false),
  ('EEE',5,3,'Control Systems',             '{control}',false,false),
  ('EEE',5,4,'Power Electronics',           '{power,electronics}',true,false),
  ('EEE',5,5,'Measurements and Instrumentation','{instrumentation}',true,false),
  ('EEE',5,6,'Renewable Energy Systems',    '{energy,power}',false,true),
  ('EEE',5,7,'Electric Vehicles',           '{energy,machines}',true,true),
  ('EEE',5,8,'Smart Grid',                  '{power,data}',false,true),
  ('EEE',7,1,'Power System Protection',     '{power}',false,false),
  ('EEE',7,2,'High Voltage Engineering',    '{power}',true,false),
  ('EEE',7,3,'Electric Drives',             '{machines,control}',true,false),
  ('EEE',7,4,'Project Phase I',             '{project}',false,false),
  ('EEE',7,5,'Professional Ethics',         '{humanities}',false,false),
  ('EEE',7,6,'Industrial Automation',       '{control,embedded}',true,true),
  ('EEE',7,7,'Energy Auditing',             '{energy}',false,true),
  ('EEE',7,8,'AI in Power Systems',         '{ai,power,python}',false,true),
  ('MECH',1,1,'Engineering Graphics',       '{design}',true,false),
  ('MECH',1,2,'Engineering Mathematics I',  '{mathematics}',false,false),
  ('MECH',1,3,'Engineering Chemistry',      '{chemistry}',true,false),
  ('MECH',1,4,'Engineering Mechanics',      '{mechanics}',false,false),
  ('MECH',1,5,'Communicative English',      '{communication}',false,false),
  ('MECH',3,1,'Thermodynamics',             '{thermal}',false,false),
  ('MECH',3,2,'Strength of Materials',      '{mechanics,materials}',true,false),
  ('MECH',3,3,'Manufacturing Processes',    '{manufacturing}',true,false),
  ('MECH',3,4,'Fluid Mechanics',            '{fluids}',true,false),
  ('MECH',3,5,'Engineering Mathematics III','{mathematics}',false,false),
  ('MECH',5,1,'Heat and Mass Transfer',     '{thermal}',true,false),
  ('MECH',5,2,'Dynamics of Machinery',      '{mechanics}',false,false),
  ('MECH',5,3,'Design of Machine Elements', '{design}',false,false),
  ('MECH',5,4,'Metrology',                  '{manufacturing,instrumentation}',true,false),
  ('MECH',5,5,'Industrial Engineering',     '{management,process}',false,false),
  ('MECH',5,6,'Computer Aided Design',      '{design,software}',true,true),
  ('MECH',5,7,'Automobile Engineering',     '{automotive,thermal}',false,true),
  ('MECH',5,8,'Additive Manufacturing',     '{manufacturing,materials}',true,true),
  ('MECH',7,1,'Finite Element Analysis',    '{design,mathematics}',true,false),
  ('MECH',7,2,'Refrigeration and Air Conditioning','{thermal}',false,false),
  ('MECH',7,3,'Mechatronics',               '{embedded,control}',true,false),
  ('MECH',7,4,'Project Phase I',            '{project}',false,false),
  ('MECH',7,5,'Professional Ethics',        '{humanities}',false,false),
  ('MECH',7,6,'Robotics',                   '{control,embedded}',true,true),
  ('MECH',7,7,'Electric Vehicle Design',    '{automotive,energy}',false,true),
  ('MECH',7,8,'Operations Research',        '{management,mathematics}',false,true),
  ('CIVIL',1,1,'Engineering Graphics',      '{design}',true,false),
  ('CIVIL',1,2,'Engineering Mathematics I', '{mathematics}',false,false),
  ('CIVIL',1,3,'Engineering Chemistry',     '{chemistry}',true,false),
  ('CIVIL',1,4,'Engineering Mechanics',     '{mechanics}',false,false),
  ('CIVIL',1,5,'Communicative English',     '{communication}',false,false),
  ('CIVIL',3,1,'Surveying',                 '{surveying}',true,false),
  ('CIVIL',3,2,'Mechanics of Solids',       '{mechanics,materials}',true,false),
  ('CIVIL',3,3,'Building Materials',        '{materials,construction}',false,false),
  ('CIVIL',3,4,'Fluid Mechanics',           '{fluids}',true,false),
  ('CIVIL',3,5,'Engineering Mathematics III','{mathematics}',false,false),
  ('CIVIL',5,1,'Structural Analysis',       '{structures}',false,false),
  ('CIVIL',5,2,'Geotechnical Engineering',  '{geotechnical}',true,false),
  ('CIVIL',5,3,'Transportation Engineering','{transport}',false,false),
  ('CIVIL',5,4,'Design of RC Structures',   '{structures,design}',false,false),
  ('CIVIL',5,5,'Environmental Engineering', '{environment}',true,false),
  ('CIVIL',5,6,'Remote Sensing and GIS',    '{gis,data}',true,true),
  ('CIVIL',5,7,'Construction Management',   '{management,construction}',false,true),
  ('CIVIL',5,8,'Green Buildings',           '{environment,energy}',false,true),
  ('CIVIL',7,1,'Design of Steel Structures','{structures,design}',false,false),
  ('CIVIL',7,2,'Estimation and Costing',    '{construction,management}',false,false),
  ('CIVIL',7,3,'Hydrology',                 '{water,environment}',false,false),
  ('CIVIL',7,4,'Project Phase I',           '{project}',false,false),
  ('CIVIL',7,5,'Professional Ethics',       '{humanities}',false,false),
  ('CIVIL',7,6,'Earthquake Engineering',    '{structures}',false,true),
  ('CIVIL',7,7,'Smart Cities',              '{transport,data}',false,true),
  ('CIVIL',7,8,'Building Information Modelling','{design,software}',true,true),
  ('MBA',1,1,'Management Principles',       '{management}',false,false),
  ('MBA',1,2,'Managerial Economics',        '{economics}',false,false),
  ('MBA',1,3,'Financial Accounting',        '{finance,accounting}',false,false),
  ('MBA',1,4,'Business Statistics',         '{data,mathematics}',true,false),
  ('MBA',1,5,'Organisational Behaviour',    '{hr}',false,false),
  ('MBA',3,1,'Strategic Management',        '{strategy}',false,false),
  ('MBA',3,2,'Business Analytics',          '{data,analytics}',true,false),
  ('MBA',3,3,'Corporate Finance',           '{finance}',false,false),
  ('MBA',3,4,'Operations Management',       '{operations}',false,false),
  ('MBA',3,5,'Business Law',                '{law}',false,false),
  ('MBA',3,6,'Digital Marketing',           '{marketing,digital}',false,true),
  ('MBA',3,7,'Investment Banking',          '{finance}',false,true),
  ('MBA',3,8,'Talent Management',           '{hr}',false,true);

insert into public.courses (department_id, code, title, credits, semester, is_elective, requires_lab, tags)
select d.id,
       cn.dept || cn.sem || lpad(cn.slot::text, 2, '0'),
       cn.title,
       case when cn.title like 'Project%' then 6 when cn.lab then 4 else 3 end,
       cn.sem, cn.elective, cn.lab, cn.tags
from course_names cn
join public.departments d on d.code = cn.dept;

-- Previous even-semester courses (needed for grade history): reuse odd titles with a "II" suffix.
insert into public.courses (department_id, code, title, credits, semester, is_elective, requires_lab, tags)
select c.department_id,
       regexp_replace(c.code, '^([A-Z]+)(\d)', '\1' || (c.semester + 1)::text),
       c.title || ' II',
       c.credits, c.semester + 1, c.is_elective, c.requires_lab, c.tags
from public.courses c
where c.semester in (1, 3, 5) and not c.is_elective and c.title not like 'Project%' and c.title <> 'Communicative English'
  and not exists (select 1 from public.departments d where d.id = c.department_id and d.code = 'MBA' and c.semester = 3);

drop table course_names;
