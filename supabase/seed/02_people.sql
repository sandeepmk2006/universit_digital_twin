-- Faculty, students and their Supabase Auth accounts.
-- Every seeded person can sign in with password EduBase@2026.

select setseed(0.2026);

create table private.seed_names as
select array['Aarav','Vivaan','Aditya','Arjun','Sai','Rohan','Karthik','Rahul','Vikram','Nikhil','Harsha','Pranav',
             'Siddharth','Varun','Abhishek','Manoj','Suresh','Deepak','Ganesh','Tejas','Yash','Akash','Kiran','Naveen'] as male,
       array['Ananya','Diya','Priya','Sneha','Kavya','Meera','Nandini','Pooja','Riya','Shreya','Divya','Lakshmi',
             'Ishita','Aishwarya','Keerthana','Neha','Swathi','Bhavana','Anjali','Sanjana'] as female,
       array['Sharma','Reddy','Iyer','Nair','Kumar','Rao','Gupta','Patel','Menon','Pillai','Shetty','Hegde','Kulkarni',
             'Joshi','Verma','Singh','Das','Bose','Mukherjee','Naidu','Gowda','Krishnan','Agarwal','Chopra','Banerjee',
             'Desai','Bhat','Kamath','Prasad','Varma'] as last;

-- Faculty: 20 per department.
insert into public.faculty (employee_no, full_name, email, department_id, designation, max_weekly_hours, joined_on)
select 'EMP' || lpad((row_number() over (order by d.code, n))::text, 4, '0'),
       fname || ' ' || lname,
       lower(fname || '.' || lname || '.' || d.code || n) || '@edubase.edu',
       d.id,
       case when n = 1 then 'Professor and Head'
            when n <= 4 then 'Professor'
            when n <= 10 then 'Associate Professor'
            else 'Assistant Professor' end,
       case when n <= 4 then 12 when n <= 10 then 14 else 16 end,
       date '2008-06-01' + (random() * 6000)::int
from public.departments d
cross join generate_series(1, 20) n
cross join private.seed_names sn
cross join lateral (
  select case when n % 3 = 0 then sn.female[1 + (random() * 19)::int] else sn.male[1 + (random() * 23)::int] end as fname,
         sn.last[1 + (random() * 29)::int] as lname
) nm;

update public.departments d
set hod_id = f.id
from public.faculty f
where f.department_id = d.id and f.designation = 'Professor and Head';

-- Students: 90 per B.Tech batch (2023-2026), 120 per MBA batch (2025-2026).
create table private.seed_students as
select d.code as dept, p.id as program_id, b.batch, n,
       random() as ability,                     -- latent academic strength
       0.55 + random() * 0.45 as diligence,     -- latent attendance tendency
       case when random() < 0.42 then 'female' else 'male' end as gender
from public.programs p
join public.departments d on d.id = p.department_id
cross join generate_series(2023, 2026) b(batch)
cross join lateral generate_series(1, case when d.code = 'MBA' then 120 else 90 end) n
where d.code <> 'MBA' or b.batch >= 2025;

insert into public.students (roll_no, full_name, email, gender, date_of_birth, program_id, batch_year, current_semester,
                             mentor_id, cgpa, interests)
select roll, fname || ' ' || lname,
       lower(fname || '.' || lname || '.' || roll) || '@student.edubase.edu',
       s.gender,
       make_date(s.batch - case when s.dept = 'MBA' then 22 else 18 end, 1 + (random() * 11)::int, 1 + (random() * 27)::int),
       s.program_id, s.batch,
       (2026 - s.batch) * 2 + 1,
       (select f.id from public.faculty f join public.departments fd on fd.id = f.department_id
         where fd.code = s.dept order by f.employee_no offset (s.n % 20) limit 1),
       case when s.batch = 2026 then null else round((5.2 + s.ability * 4.4 + (random() - 0.5) * 0.6)::numeric, 2) end,
       (select array_agg(distinct t) from (
          select unnest(c.tags) t from public.courses c join public.departments cd on cd.id = c.department_id
          where cd.code = s.dept order by random() limit 3) x)
from private.seed_students s
cross join private.seed_names sn
cross join lateral (
  select right(s.batch::text, 2) || s.dept || lpad(s.n::text, 3, '0') as roll,
         case when s.gender = 'female' then sn.female[1 + (random() * 19)::int] else sn.male[1 + (random() * 23)::int] end as fname,
         sn.last[1 + (random() * 29)::int] as lname
) nm;

update public.students set cgpa = least(cgpa, 9.85) where cgpa is not null;

alter table private.seed_students add column student_id uuid;
update private.seed_students s
set student_id = st.id
from public.students st
where st.roll_no = right(s.batch::text, 2) || s.dept || lpad(s.n::text, 3, '0');

-- Auth accounts. One bcrypt hash is reused so the seed runs quickly.
create table private.seed_accounts (email citext primary key, full_name text, role public.user_role);

insert into private.seed_accounts
select email, full_name, case when designation = 'Professor and Head' then 'hod' else 'faculty' end::public.user_role
from public.faculty;

insert into private.seed_accounts select email, full_name, 'student' from public.students;

insert into private.seed_accounts values
  ('admin@edubase.edu',      'Registrar Office',   'admin'),
  ('warden@edubase.edu',     'Chief Warden',       'warden'),
  ('placements@edubase.edu', 'Placement Cell',     'placement_officer'),
  ('library@edubase.edu',    'Central Library',    'librarian'),
  ('transport@edubase.edu',  'Transport Office',   'transport_manager'),
  ('health@edubase.edu',     'Dr. Health Centre',  'doctor'),
  ('security@edubase.edu',   'Main Gate Security', 'security'),
  ('accounts@edubase.edu',   'Accounts Section',   'accountant');

with pw as (select extensions.crypt('EduBase@2026', extensions.gen_salt('bf', 8)) as hash)
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
       a.email, pw.hash, now(),
       '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', a.full_name),
       now(), now(), '', '', '', ''
from private.seed_accounts a cross join pw;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
join private.seed_accounts a on a.email = u.email;

update public.profiles p set role = a.role
from private.seed_accounts a where a.email = p.email;

update public.faculty f set profile_id = p.id from public.profiles p where p.email = f.email;
update public.students s set profile_id = p.id from public.profiles p where p.email = s.email;

drop table private.seed_accounts;
drop table private.seed_names;
