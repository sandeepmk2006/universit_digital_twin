-- A student's own hostel room, warden and room-mates. RLS rightly hides other
-- students' rows, so this narrow definer function returns only the caller's room.

create or replace function public.my_hostel()
returns table (hostel text, room_no text, warden text, since date, roommates text[])
language sql stable security definer set search_path = '' as $$
  select h.name, hr.room_no, w.full_name, ha.from_date,
         coalesce(array(
           select s2.roll_no || '  ' || s2.full_name
           from public.hostel_allocations a2
           join public.students s2 on s2.id = a2.student_id
           where a2.hostel_room_id = ha.hostel_room_id and a2.to_date is null and a2.student_id <> ha.student_id
           order by s2.roll_no), '{}')
  from public.hostel_allocations ha
  join public.hostel_rooms hr on hr.id = ha.hostel_room_id
  join public.hostels h on h.id = hr.hostel_id
  left join public.profiles w on w.id = h.warden_id
  where ha.student_id = private.my_student_id() and ha.to_date is null
$$;

revoke execute on function public.my_hostel() from public, anon;
grant execute on function public.my_hostel() to authenticated;
