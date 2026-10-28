-- A warden works in one hostel: they see only that hostel and its rooms. Everyone else
-- keeps the read access they had (students see hostel names for their allocation).
drop policy "read: signed-in" on public.hostels;
create policy "read: signed-in, wardens own hostel" on public.hostels for select to authenticated using (
  not (select private.has_role('warden')) or warden_id = (select auth.uid()));

drop policy "read: signed-in" on public.hostel_rooms;
create policy "read: signed-in, wardens own hostel" on public.hostel_rooms for select to authenticated using (
  not (select private.has_role('warden')) or hostel_id in (select private.my_hostels()));
