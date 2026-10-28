-- One warden per hostel. warden@edubase.edu keeps Kaveri Hall; the other halls get
-- their own accounts, which reuse the existing warden's password hash.
create temporary table new_wardens (email text, full_name text, hostel text);
insert into new_wardens values
  ('warden.godavari@edubase.edu', 'Godavari Hall Warden', 'Godavari Hall'),
  ('warden.krishna@edubase.edu',  'Krishna Hall Warden',  'Krishna Hall'),
  ('warden.narmada@edubase.edu',  'Narmada Hall Warden',  'Narmada Hall');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
       w.email, (select encrypted_password from auth.users where email = 'warden@edubase.edu'), now(),
       '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', w.full_name),
       now(), now(), '', '', '', ''
from new_wardens w
where not exists (select 1 from auth.users u where u.email = w.email);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u join new_wardens w on w.email = u.email
where not exists (select 1 from auth.identities i where i.user_id = u.id);

update public.profiles p set role = 'warden', full_name = w.full_name
from new_wardens w where w.email = p.email;
update public.profiles set full_name = 'Kaveri Hall Warden' where email = 'warden@edubase.edu';

update public.hostels h set warden_id = p.id
from new_wardens w join public.profiles p on p.email = w.email
where h.name = w.hostel;
