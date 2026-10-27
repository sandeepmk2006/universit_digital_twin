-- Unique, realistic names for every person; reg-number-based student logins
-- (urk23cs1001@student.edubase.edu, like Karunya); profile details, parents,
-- and sample leave / service requests. Run after 01-07.

create table private.np (gender text, first text);
insert into private.np select 'male', unnest(array[
  'Aarav','Vivaan','Aditya','Arjun','Sai','Rohan','Karthik','Rahul','Vikram','Nikhil','Harsha','Pranav',
  'Siddharth','Varun','Abhishek','Manoj','Suresh','Deepak','Ganesh','Tejas','Yash','Akash','Kiran','Naveen',
  'Ajay','Arun','Bharath','Chetan','Darshan','Dinesh','Gautham','Gokul','Hari','Ishaan','Jagan','Jeevan',
  'Kabir','Kishore','Lokesh','Madhav','Mohan','Naresh','Omkar','Pavan','Prakash','Raghav','Rajesh','Sachin',
  'Sanjay','Santhosh','Shiva','Sriram','Sudhir','Tarun','Uday','Vasanth','Venkat','Vignesh','Vinay','Vishal',
  'Yogesh','Ashwin','Bala','Charan','Dev','Eshwar','Farhan','Imran','Joel','Kevin','Praveen','Mukesh']);
insert into private.np select 'female', unnest(array[
  'Ananya','Diya','Priya','Sneha','Kavya','Meera','Nandini','Pooja','Riya','Shreya','Divya','Lakshmi',
  'Ishita','Aishwarya','Keerthana','Neha','Swathi','Bhavana','Anjali','Sanjana','Aarthi','Bhuvana','Chitra',
  'Deepika','Gayathri','Harini','Indhu','Janani','Kalpana','Lavanya','Madhumitha','Nisha','Pavithra','Ramya',
  'Sahana','Tanvi','Uma','Vaishnavi','Yamini','Akshaya','Brinda','Charulatha','Dharani','Ezhil','Fathima',
  'Gowri','Hema','Iniya','Jasmine','Kaviya','Malini','Nithya','Preethi','Revathi','Sowmya','Thanuja','Varsha',
  'Mythili','Shruti']);
create table private.nl (last text);
insert into private.nl select unnest(array[
  'Sharma','Reddy','Iyer','Nair','Kumar','Rao','Gupta','Patel','Menon','Pillai','Shetty','Hegde','Kulkarni',
  'Joshi','Verma','Singh','Das','Bose','Mukherjee','Naidu','Gowda','Krishnan','Agarwal','Chopra','Banerjee',
  'Desai','Bhat','Kamath','Prasad','Varma','Raman','Subramanian','Venkatesan','Raghavan','Srinivasan',
  'Natarajan','Chandran','Balakrishnan','Mohan','Rajan','Thomas','Joseph','George','Mathew','Francis',
  'Fernandes','Kapoor','Malhotra','Saxena','Mishra','Pandey','Tiwari','Chatterjee','Ghosh','Sen','Dutta',
  'Jain','Mehta','Shah','Arora','Bhatia','Sethi']);

-- Every (first, last) pair once, in a stable shuffled order per gender.
create table private.combos as
select np.gender, np.first, nl.last,
       row_number() over (partition by np.gender order by md5(np.first || '|' || nl.last)) as rn
from private.np cross join private.nl;

-- Students: unique name, login = reg number.
with s as (
  select id, gender, row_number() over (partition by gender order by roll_no) rn from public.students
)
update public.students st
set full_name = c.first || ' ' || c.last,
    email     = lower(st.roll_no) || '@student.edubase.edu'
from s join private.combos c on c.gender = s.gender and c.rn = s.rn
where st.id = s.id;

-- Faculty: the next unused names; professors carry "Dr.".
create table private.fac as
select id, g, row_number() over (partition by g order by employee_no) rn
from (select id, employee_no,
             case when row_number() over (order by employee_no) % 3 = 0 then 'female' else 'male' end g
      from public.faculty) x;

create table private.used as
select gender, count(*)::int n from public.students group by gender;

update public.faculty fa
set full_name = case when fa.designation in ('Professor', 'Professor and Head') then 'Dr. ' else '' end
                || c.first || ' ' || c.last,
    email     = lower(c.first || '.' || c.last) || '@edubase.edu'
from private.fac f
join private.used u on u.gender = f.g
join private.combos c on c.gender = f.g and c.rn = u.n + f.rn
where fa.id = f.id;

update private.used u set n = u.n + x.k
from (select g, count(*)::int k from private.fac group by g) x where x.g = u.gender;

-- Applicants and alumni get real names too.
with a as (
  select id, g, row_number() over (partition by g order by id) rn
  from (select id, case when row_number() over (order by id) % 2 = 0 then 'female' else 'male' end g
        from public.applicants) x
)
update public.applicants ap
set full_name = c.first || ' ' || c.last,
    email     = lower(c.first || '.' || c.last) || '@example.com'
from a join private.used u on u.gender = a.g
join private.combos c on c.gender = a.g and c.rn = u.n + a.rn
where ap.id = a.id;

-- Recount everyone named so far so alumni take the next unused names.
delete from private.used;
insert into private.used
select g, count(*)::int from (
  select gender g from public.students
  union all select g from private.fac
  union all select case when row_number() over (order by id) % 2 = 0 then 'female' else 'male' end from public.applicants
) t group by g;

with a as (
  select id, g, row_number() over (partition by g order by id) rn
  from (select id, case when row_number() over (order by id) % 2 = 0 then 'female' else 'male' end g
        from public.alumni) x
)
update public.alumni al
set full_name = c.first || ' ' || c.last
from a join private.used u on u.gender = a.g
join private.combos c on c.gender = a.g and c.rn = u.n + a.rn
where al.id = a.id;

-- Keep profiles and auth accounts in step.
update public.profiles p set full_name = s.full_name, email = s.email from public.students s where s.profile_id = p.id;
update public.profiles p set full_name = f.full_name, email = f.email from public.faculty f where f.profile_id = p.id;
update auth.users u
set email = p.email, raw_user_meta_data = jsonb_build_object('full_name', p.full_name)
from public.profiles p
where p.id = u.id and u.email is distinct from p.email::text;
update auth.identities i
set identity_data = i.identity_data || jsonb_build_object('email', u.email)
from auth.users u
where i.user_id = u.id and i.provider = 'email';

-- Personal details.
update public.students st
set mobile         = '9' || lpad((abs(hashtext(st.roll_no || 'm')) % 1000000000)::text, 9, '0'),
    blood_group    = (array['O+','A+','B+','AB+','O-','A-','B-'])[1 + abs(hashtext(st.roll_no || 'b')) % 7],
    address        = (1 + abs(hashtext(st.roll_no || 'h')) % 300)::text || ', ' || a.street,
    city           = a.city,
    pincode        = a.pin,
    admission_date = make_date(st.batch_year, 6, 10 + abs(hashtext(st.roll_no || 'd')) % 18),
    admission_type = case when st.current_semester >= 3 and abs(hashtext(st.roll_no || 'l')) % 12 = 0
                          then 'Lateral Entry' else 'Regular' end
from (values
  (0,'Gandhi Road','Coimbatore','641001'),(1,'Avinashi Road','Coimbatore','641018'),
  (2,'Race Course Road','Coimbatore','641018'),(3,'Anna Nagar','Chennai','600040'),
  (4,'T Nagar','Chennai','600017'),(5,'MG Road','Bengaluru','560001'),(6,'Jayanagar','Bengaluru','560041'),
  (7,'Kakkanad','Kochi','682030'),(8,'Palayamkottai','Tirunelveli','627002'),(9,'KK Nagar','Madurai','625020'),
  (10,'Fairlands','Salem','636016'),(11,'Banjara Hills','Hyderabad','500034')
) a(k, street, city, pin)
where a.k = abs(hashtext(st.roll_no || 'c')) % 12;

-- Parents.
delete from public.guardians;
insert into public.guardians (student_id, name, relation, phone, email)
select s.id,
       (select first from private.np where gender = rel.g order by md5(s.id::text || first) limit 1)
         || ' ' || split_part(s.full_name, ' ', 2),
       rel.r,
       '9' || lpad((abs(hashtext(s.roll_no || rel.r)) % 1000000000)::text, 9, '0'),
       null
from public.students s
cross join (values ('father', 'male'), ('mother', 'female')) rel(r, g);

-- A few leave applications and service requests.
insert into public.leave_requests (student_id, leave_type, subject, reason, from_date, to_date, status, created_at)
select s.id, v.t, v.subj, v.reason, d, d + v.days, v.st, d - 2
from public.students s
join (values
  (0, 'medical', 'Medical leave', 'Viral fever, certificate from Health Centre attached.', 1, 'approved'),
  (1, 'on_duty', 'On duty - symposium', 'Presenting a paper at the inter-college symposium.', 1, 'approved'),
  (2, 'personal', 'Family function', 'Sister''s wedding at hometown.', 2, 'pending'),
  (3, 'emergency', 'Family emergency', 'Grandfather hospitalised.', 0, 'rejected')
) v(k, t, subj, reason, days, st) on v.k = abs(hashtext(s.roll_no || 'lv')) % 4
cross join lateral (select date '2026-08-01' + abs(hashtext(s.roll_no || 'ld')) % 80 as d) dd
where abs(hashtext(s.roll_no || 'lp')) % 100 < 12;

insert into public.service_requests (student_id, service, purpose, fee, status, created_at)
select s.id, v.svc, v.purpose, v.fee, v.st, timestamptz '2026-08-01' + (abs(hashtext(s.roll_no || 'sd')) % 80 || ' days')::interval
from public.students s
join (values
  (0, 'Bonafide certificate', 'Educational loan', 0, 'ready'),
  (1, 'Bonafide certificate', 'Passport application', 0, 'processing'),
  (2, 'Identity card with tag', 'Lost ID card', 300, 'submitted'),
  (3, 'Migration certificate', 'Higher studies', 400, 'submitted')
) v(k, svc, purpose, fee, st) on v.k = abs(hashtext(s.roll_no || 'sv')) % 4
where abs(hashtext(s.roll_no || 'sp')) % 100 < 6;

drop table private.used, private.fac, private.combos, private.nl, private.np;
