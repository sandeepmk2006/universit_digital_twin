-- Academic terms named as on EduServe ("2026-27 Odd Semester"), every semester back to
-- the 2023 batch's first, and paid fee invoices for each semester a student has completed,
-- so a 4th-year student can pick any of their 7 semesters.
update public.academic_terms set name = '2025-26 Odd'  where name = '2025 Odd';
update public.academic_terms set name = '2025-26 Even' where name = '2026 Even';
update public.academic_terms set name = '2026-27 Odd'  where name = '2026 Odd';

insert into public.academic_terms (name, starts_on, ends_on, is_current)
select v.name, v.s::date, v.e::date, false
from (values
  ('2023-24 Odd',  '2023-07-17', '2023-12-08'),
  ('2023-24 Even', '2024-01-08', '2024-05-24'),
  ('2024-25 Odd',  '2024-07-22', '2024-12-13'),
  ('2024-25 Even', '2025-01-06', '2025-05-23')) v(name, s, e)
where not exists (select 1 from public.academic_terms t where t.name = v.name);

-- Term n steps before the current one = the term of semester (current_semester - n).
with terms as (
  select id, starts_on, row_number() over (order by starts_on) as idx from public.academic_terms
), cur as (
  select idx from terms join public.academic_terms a using (id) where a.is_current
), past as (
  select s.id as student_id, t.id as term_id, t.starts_on, i.amount
  from public.students s
  join public.invoices i on i.student_id = s.id
  join public.academic_terms ct on ct.id = i.term_id and ct.is_current
  cross join generate_series(1, 7) k
  join terms t on t.idx = (select idx from cur) - (s.current_semester - k)
  where k < s.current_semester
    and not exists (select 1 from public.invoices x where x.student_id = s.id and x.term_id = t.id)
), ins as (
  insert into public.invoices (student_id, term_id, amount, due_on, status, created_at)
  select student_id, term_id, amount, starts_on + 30, 'paid', starts_on::timestamptz
  from past
  returning id, amount, due_on
)
insert into public.payments (invoice_id, amount, method, reference, paid_at)
select id, amount,
       (array['card', 'upi', 'netbanking', 'cheque'])[1 + floor(random() * 4)::int],
       'TXN' || upper(substr(md5(id::text), 1, 12)),
       (due_on - (floor(random() * 20))::int)::timestamptz + interval '11 hours'
from ins;

-- Karunya's residences replace the placeholder hostel names, and each warden's
-- account is named after their residence.
create temporary table residences (old text, name text, email text);
insert into residences values
  ('Kaveri Hall',   'Jerry Manuel Residence',       'warden.jerrymanuel@edubase.edu'),
  ('Godavari Hall', 'Father Duraisamy Residence',   'warden.duraisamy@edubase.edu'),
  ('Krishna Hall',  'Dakshinamoorthi Residence',    'warden.dakshinamoorthi@edubase.edu'),
  ('Narmada Hall',  'Sevugapandian Residence',      'warden.sevugapandian@edubase.edu');

update public.profiles p set email = r.email, full_name = r.name || ' Warden'
from residences r join public.hostels h on h.name = r.old
where p.id = h.warden_id;

update auth.users u set email = r.email, raw_user_meta_data = jsonb_build_object('full_name', r.name || ' Warden')
from residences r join public.hostels h on h.name = r.old
where u.id = h.warden_id;

update auth.identities i set identity_data = i.identity_data || jsonb_build_object('email', r.email)
from residences r join public.hostels h on h.name = r.old
where i.user_id = h.warden_id;

update public.hostels h set name = r.name from residences r where h.name = r.old;
