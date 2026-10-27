-- Hostel, library, transport, clubs, events, sports, health centre, visitors.

select setseed(0.6);

-- Hostel
insert into public.hostels (name, gender, warden_id, capacity)
select h.name, h.gender, (select id from public.profiles where email = 'warden@edubase.edu'), h.cap
from (values ('Kaveri Hall', 'male', 480), ('Godavari Hall', 'male', 480), ('Krishna Hall', 'female', 360), ('Narmada Hall', 'female', 360)) h(name, gender, cap);

insert into public.hostel_rooms (hostel_id, room_no, beds)
select h.id, (f * 100 + n)::text, 3 from public.hostels h cross join generate_series(1, 4) f cross join generate_series(1, h.capacity / 12) n;

with candidates as (
  select st.id, st.gender, row_number() over (partition by st.gender order by random()) rn
  from public.students st where random() < 0.6
), beds as (
  select hr.id, h.gender, row_number() over (partition by h.gender order by h.name, hr.room_no, b) rn
  from public.hostel_rooms hr join public.hostels h on h.id = hr.hostel_id cross join generate_series(1, hr.beds) b
)
insert into public.hostel_allocations (hostel_room_id, student_id, from_date)
select b.id, c.id, date '2026-07-15'
from candidates c join beds b on b.gender = c.gender and b.rn = c.rn;

insert into public.hostel_complaints (student_id, hostel_id, category, details, status, created_at)
select ha.student_id, hr.hostel_id, c.cat, c.details,
       (array['open', 'in_progress', 'resolved', 'resolved'])[1 + (random() * 3)::int],
       now() - (random() * 90 || ' days')::interval
from public.hostel_allocations ha join public.hostel_rooms hr on hr.id = ha.hostel_room_id
cross join lateral (select * from (values
  ('electrical', 'Ceiling fan not working since last week.'),
  ('plumbing', 'Water leakage in the attached bathroom.'),
  ('internet', 'Wi-Fi drops every evening between 8 and 11 pm.'),
  ('mess', 'Dinner served cold on most weekdays.'),
  ('furniture', 'Study table drawer is broken.')) v(cat, details) where ha.student_id is not null order by random() limit 1) c
where random() < 0.06;

-- Library
insert into public.books (isbn, title, authors, publisher, year, subjects)
select '978' || lpad((abs(hashtext(b.title)) % 10000000000)::text, 10, '0'), b.title, b.authors, b.publisher, b.year, b.subjects
from (values
  ('Introduction to Algorithms', array['Thomas H. Cormen','Charles E. Leiserson','Ronald L. Rivest','Clifford Stein'], 'MIT Press', 2022, array['algorithms','programming']),
  ('Operating System Concepts', array['Abraham Silberschatz','Peter B. Galvin','Greg Gagne'], 'Wiley', 2018, array['systems']),
  ('Database System Concepts', array['Abraham Silberschatz','Henry F. Korth','S. Sudarshan'], 'McGraw Hill', 2019, array['databases','data']),
  ('Computer Networking: A Top-Down Approach', array['James Kurose','Keith Ross'], 'Pearson', 2021, array['networks']),
  ('Hands-On Machine Learning', array['Aurelien Geron'], 'O''Reilly', 2022, array['ai','python','data']),
  ('Deep Learning', array['Ian Goodfellow','Yoshua Bengio','Aaron Courville'], 'MIT Press', 2016, array['ai']),
  ('Clean Code', array['Robert C. Martin'], 'Pearson', 2008, array['software','programming']),
  ('Design Patterns', array['Erich Gamma','Richard Helm','Ralph Johnson','John Vlissides'], 'Addison-Wesley', 1994, array['software']),
  ('The C Programming Language', array['Brian W. Kernighan','Dennis M. Ritchie'], 'Prentice Hall', 1988, array['programming','fundamentals']),
  ('Microelectronic Circuits', array['Adel S. Sedra','Kenneth C. Smith'], 'Oxford', 2020, array['electronics','circuits']),
  ('Signals and Systems', array['Alan V. Oppenheim','Alan S. Willsky'], 'Pearson', 1996, array['signals']),
  ('Digital Design', array['M. Morris Mano','Michael D. Ciletti'], 'Pearson', 2018, array['hardware','electronics']),
  ('Electric Machinery Fundamentals', array['Stephen J. Chapman'], 'McGraw Hill', 2011, array['machines']),
  ('Power System Analysis', array['John J. Grainger','William D. Stevenson'], 'McGraw Hill', 1994, array['power']),
  ('Modern Control Engineering', array['Katsuhiko Ogata'], 'Pearson', 2010, array['control']),
  ('Engineering Thermodynamics', array['P. K. Nag'], 'McGraw Hill', 2017, array['thermal']),
  ('Fluid Mechanics', array['Frank M. White'], 'McGraw Hill', 2015, array['fluids']),
  ('Mechanics of Materials', array['Ferdinand P. Beer','E. Russell Johnston'], 'McGraw Hill', 2014, array['mechanics','materials']),
  ('Design of Machine Elements', array['V. B. Bhandari'], 'McGraw Hill', 2016, array['design']),
  ('Structural Analysis', array['R. C. Hibbeler'], 'Pearson', 2017, array['structures']),
  ('Soil Mechanics and Foundations', array['B. C. Punmia'], 'Laxmi', 2017, array['geotechnical']),
  ('Surveying Vol. 1', array['S. K. Duggal'], 'McGraw Hill', 2013, array['surveying']),
  ('Higher Engineering Mathematics', array['B. S. Grewal'], 'Khanna', 2020, array['mathematics']),
  ('Principles of Marketing', array['Philip Kotler','Gary Armstrong'], 'Pearson', 2020, array['marketing']),
  ('Corporate Finance', array['Stephen A. Ross','Randolph W. Westerfield'], 'McGraw Hill', 2019, array['finance']),
  ('Organizational Behavior', array['Stephen P. Robbins','Timothy A. Judge'], 'Pearson', 2019, array['hr']),
  ('Competitive Strategy', array['Michael E. Porter'], 'Free Press', 1998, array['strategy']),
  ('Data Science for Business', array['Foster Provost','Tom Fawcett'], 'O''Reilly', 2013, array['data','analytics']),
  ('Artificial Intelligence: A Modern Approach', array['Stuart Russell','Peter Norvig'], 'Pearson', 2020, array['ai']),
  ('Computer Graphics with OpenGL', array['Donald Hearn','M. Pauline Baker'], 'Pearson', 2013, array['graphics'])
) b(title, authors, publisher, year, subjects);

insert into public.book_copies (book_id, barcode, shelf)
select b.id, 'LIB' || lpad((row_number() over (order by b.title, k))::text, 6, '0'),
       upper(left(b.subjects[1], 3)) || '-' || (1 + (random() * 9)::int)
from public.books b cross join generate_series(1, 8) k;

insert into public.book_loans (copy_id, borrower_id, issued_on, due_on, returned_on, fine_amount)
select bc.id, st.profile_id, d.issued, d.issued + 14,
       case when random() < 0.7 and d.issued < date '2026-10-20' then d.issued + (3 + random() * 16)::int end, 0
from (select id, row_number() over (order by random()) rn from public.book_copies) bc
join (select profile_id, row_number() over (order by random()) rn from public.students) st on st.rn = bc.rn
cross join lateral (select date '2026-08-01' + (random() * 85 + bc.rn * 0)::int as issued) d;

update public.book_loans set fine_amount = (returned_on - due_on) * 5 where returned_on > due_on;
update public.book_loans set fine_amount = (date '2026-10-27' - due_on) * 5 where returned_on is null and due_on < date '2026-10-27';

-- Transport
insert into public.bus_routes (code, name) values
  ('R1', 'Majestic - Campus'), ('R2', 'Whitefield - Campus'), ('R3', 'Electronic City - Campus'),
  ('R4', 'Yelahanka - Campus'), ('R5', 'Banashankari - Campus'), ('R6', 'Hebbal - Campus');

insert into public.bus_stops (route_id, name, seq, pickup_at, latitude, longitude)
select r.id, r.code || ' Stop ' || s, s, time '07:00' + (s * 8 || ' minutes')::interval,
       12.90 + random() * 0.15, 77.50 + random() * 0.2
from public.bus_routes r cross join generate_series(1, 7) s;

insert into public.buses (registration, capacity, route_id, driver_name, driver_phone)
select 'KA-01-F-' || (4100 + n), 52, (select id from public.bus_routes order by code offset (n - 1) % 6 limit 1),
       (array['Ramesh','Mahesh','Shivakumar','Basavaraj','Venkatesh','Prakash','Manjunath','Nagaraj'])[n],
       '98450' || lpad((n * 1371)::text, 5, '0')
from generate_series(1, 8) n;

insert into public.bus_locations (bus_id, latitude, longitude)
select id, 12.93 + random() * 0.1, 77.55 + random() * 0.1 from public.buses;

with stops as (select id, row_number() over (order by id) - 1 as k, count(*) over () as total from public.bus_stops)
insert into public.bus_passes (profile_id, stop_id, valid_from, valid_to)
select st.profile_id, s.id, '2026-07-20', '2026-12-11'
from public.students st
join stops s on s.k = abs(hashtext(st.roll_no)) % s.total
where not exists (select 1 from public.hostel_allocations ha where ha.student_id = st.id) and random() < 0.55;

-- Clubs, events, sports
insert into public.clubs (name, category, faculty_advisor, description)
select c.name, c.cat, (select id from public.faculty order by employee_no offset c.k * 11 limit 1), c.descr
from (values
  (0, 'Coding Club', 'technical', 'Weekly contests and interview preparation.'),
  (1, 'Robotics Society', 'technical', 'Builds robots for national competitions.'),
  (2, 'IEEE Student Branch', 'technical', 'Talks, workshops and paper reading sessions.'),
  (3, 'E-Cell', 'entrepreneurship', 'Startup mentoring and pitch events.'),
  (4, 'Dramatics Club', 'cultural', 'Stage and street plays.'),
  (5, 'Music Club', 'cultural', 'Bands, choir and open mics.'),
  (6, 'Photography Club', 'cultural', 'Photo walks and exhibitions.'),
  (7, 'NSS Unit', 'social', 'Community service and blood donation camps.'),
  (8, 'Literary Society', 'cultural', 'Debates, quizzes and the campus magazine.'),
  (9, 'Finance Club', 'management', 'Market simulations and case studies.')
) c(k, name, cat, descr);

with clubs as (select id, row_number() over (order by name) - 1 as k from public.clubs)
insert into public.club_members (club_id, student_id, position)
select c.id, st.id, case when random() < 0.04 then 'coordinator' else 'member' end
from public.students st
join clubs c on c.k = abs(hashtext(st.roll_no || 'club')) % 10
where random() < 0.35;

insert into public.events (title, description, organiser_club_id, room_id, starts_at, ends_at, capacity)
select e.title, e.descr, (select id from public.clubs where name = e.club), (select id from public.rooms where code = e.room),
       e.starts::timestamptz, e.starts::timestamptz + (e.hours || ' hours')::interval, e.cap
from (values
  ('CodeSprint 2026', '24-hour hackathon open to all departments.', 'Coding Club', 'CC-AUD', '2026-11-07 09:00+05:30', 24, 400),
  ('Robo Wars Qualifier', 'Qualifier round for the national robo wars.', 'Robotics Society', 'TB-L01', '2026-11-14 10:00+05:30', 6, 60),
  ('IEEE Talk: Edge AI', 'Guest lecture on deploying models on microcontrollers.', 'IEEE Student Branch', 'MB-S1', '2026-10-30 15:00+05:30', 2, 150),
  ('Startup Pitch Day', 'Student teams pitch to angel investors.', 'E-Cell', 'MB-S2', '2026-11-21 10:00+05:30', 5, 150),
  ('Rangmanch', 'Annual inter-college drama festival.', 'Dramatics Club', 'CC-AUD', '2026-12-04 17:00+05:30', 4, 800),
  ('Blood Donation Camp', 'In partnership with the city blood bank.', 'NSS Unit', 'MB-S3', '2026-11-02 09:00+05:30', 6, 150),
  ('Mock Placement Week', 'Aptitude tests and mock interviews.', 'Coding Club', 'AB1-101', '2026-10-12 09:00+05:30', 8, 60),
  ('Photo Walk: Heritage', 'Guided walk through the old city.', 'Photography Club', null, '2026-09-27 06:30+05:30', 4, 40),
  ('Inter-Department Quiz', 'General quiz, teams of three.', 'Literary Society', 'MB-S4', '2026-09-18 14:00+05:30', 3, 150),
  ('Budget 2026 Decoded', 'Panel on the union budget.', 'Finance Club', 'MB-S1', '2026-08-29 15:00+05:30', 2, 150)
) e(title, descr, club, room, starts, hours, cap);

insert into public.event_registrations (event_id, profile_id, attended)
select ev.id, st.profile_id, ev.starts_at < now() and random() < 0.8
from public.events ev
cross join lateral (
  select profile_id from public.students
  where abs(hashtext(roll_no || ev.title)) % 100 < 100 * ev.capacity * 0.6 / 2040
) st;

insert into public.sports_facilities (name, sport, capacity) values
  ('Main Cricket Ground', 'cricket', 30), ('Football Field', 'football', 30), ('Indoor Badminton Hall', 'badminton', 16),
  ('Basketball Court', 'basketball', 20), ('Swimming Pool', 'swimming', 25), ('Gymnasium', 'fitness', 40),
  ('Table Tennis Room', 'table_tennis', 8);

insert into public.facility_bookings (facility_id, booked_by, starts_at, ends_at)
select f.id, (select profile_id from public.students order by roll_no offset (d * 37 + length(f.name) * 13) limit 1),
       ((date '2026-10-26' + d) + time '17:00') at time zone 'Asia/Kolkata',
       ((date '2026-10-26' + d) + time '18:30') at time zone 'Asia/Kolkata'
from public.sports_facilities f cross join generate_series(0, 6) d;

insert into public.sports_achievements (student_id, sport, level, title, achieved_on)
select st.id, s.sport, s.level, s.title, date '2025-08-01' + (random() * 420)::int
from public.students st
join (values
  (0, 'cricket', 'inter_college', 'Runner-up, VTU Inter-Collegiate Cricket'),
  (1, 'football', 'state', 'State Under-21 Football Squad'),
  (2, 'badminton', 'inter_college', 'Winner, Zonal Badminton Singles'),
  (3, 'athletics', 'national', 'Bronze, 400m, All India Inter-University'),
  (4, 'chess', 'state', 'Karnataka State Rapid Chess, 3rd place'),
  (5, 'basketball', 'intra', 'Inter-Department Basketball Champions')) s(k, sport, level, title)
  on s.k = abs(hashtext(st.roll_no || 'sport')) % 6
where st.batch_year < 2026 and random() < 0.04;

-- Health centre and visitors
insert into public.medicine_stock (name, quantity, reorder_at, expires_on) values
  ('Paracetamol 500mg', 1200, 300, '2027-08-31'), ('Cetirizine 10mg', 400, 100, '2027-03-31'),
  ('ORS Sachet', 260, 100, '2027-01-31'), ('Ibuprofen 400mg', 80, 150, '2027-05-31'),
  ('Antiseptic Solution 500ml', 24, 10, '2028-01-31'), ('Bandage Roll', 140, 50, '2029-12-31'),
  ('Amoxicillin 500mg', 60, 80, '2026-12-31'), ('Pantoprazole 40mg', 300, 100, '2027-06-30');

insert into public.medical_visits (patient_id, doctor_id, visited_at, complaint, diagnosis, prescription)
select st.profile_id, (select id from public.profiles where email = 'health@edubase.edu'),
       timestamptz '2026-07-21 09:30+05:30' + (random() * 98 || ' days')::interval, v.c, v.d, v.p
from public.students st
join (values
  (0, 'Fever and body ache', 'Viral fever', 'Paracetamol 500mg, rest for 2 days'),
  (1, 'Sneezing and runny nose', 'Allergic rhinitis', 'Cetirizine 10mg at night for 5 days'),
  (2, 'Sprained ankle during football', 'Grade 1 ankle sprain', 'Ice, compression bandage, Ibuprofen 400mg'),
  (3, 'Stomach pain', 'Gastritis', 'Pantoprazole 40mg before breakfast for 7 days'),
  (4, 'Headache', 'Tension headache', 'Paracetamol 500mg as needed, hydration')) v(k, c, d, p)
  on v.k = abs(hashtext(st.roll_no || 'med')) % 5
where random() < 0.1;

insert into public.visitors (full_name, phone, id_proof, purpose, host_id, checked_in_at, checked_out_at, logged_by)
select v.name, '9' || lpad((n * 7919 % 999999999)::text, 9, '0'), 'Aadhaar XXXX-' || lpad((n * 37 % 9999)::text, 4, '0'),
       v.purpose, (select profile_id from public.faculty order by employee_no offset n % 120 limit 1), t.cin,
       case when t.cin < timestamptz '2026-10-27 12:00+05:30' then t.cin + (30 + random() * 180 || ' minutes')::interval end,
       (select id from public.profiles where email = 'security@edubase.edu')
from generate_series(1, 120) n
cross join lateral (select timestamptz '2026-10-01 09:00+05:30' + ((n * 0.22)::int || ' days')::interval + (random() * 8 + n * 0 || ' hours')::interval as cin) t
join (values
  (0, 'Parent visit', 'Ravi Shankar'), (1, 'Vendor - lab equipment', 'Sunil Traders'), (2, 'Guest lecture', 'Dr. Meenakshi Rao'),
  (3, 'Recruiter meeting', 'Infosys HR Team'), (4, 'Parent visit', 'Lata Krishnan'), (5, 'Interview candidate', 'Arvind Menon'),
  (6, 'Courier delivery', 'BlueDart Courier')) v(k, purpose, name) on v.k = n % 7;
