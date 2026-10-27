-- Hostel, library, transport, clubs, events, sports, health centre, visitors.

-- Hostel ---------------------------------------------------------------------
create table public.hostels (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  gender     text not null check (gender in ('male', 'female', 'mixed')),
  warden_id  uuid references public.profiles(id),
  capacity   integer not null
);

create table public.hostel_rooms (
  id         uuid primary key default gen_random_uuid(),
  hostel_id  uuid not null references public.hostels(id) on delete cascade,
  room_no    text not null,
  beds       smallint not null check (beds > 0),
  unique (hostel_id, room_no)
);

create table public.hostel_allocations (
  id              uuid primary key default gen_random_uuid(),
  hostel_room_id  uuid not null references public.hostel_rooms(id),
  student_id      uuid not null references public.students(id) on delete cascade,
  from_date       date not null,
  to_date         date,
  check (to_date is null or to_date >= from_date)
);
create unique index hostel_one_active_bed on public.hostel_allocations (student_id) where to_date is null;
create index on public.hostel_allocations (hostel_room_id);

create table public.hostel_complaints (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  hostel_id   uuid not null references public.hostels(id),
  category    text not null,
  details     text not null,
  status      text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  created_at  timestamptz not null default now()
);
create index on public.hostel_complaints (hostel_id, status);

-- Library ----------------------------------------------------------------------
create table public.books (
  id         uuid primary key default gen_random_uuid(),
  isbn       text unique,
  title      text not null,
  authors    text[] not null,
  publisher  text,
  year       smallint,
  subjects   text[] not null default '{}'
);
create index books_title_search on public.books using gin (to_tsvector('english', title));

create table public.book_copies (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references public.books(id) on delete cascade,
  barcode     text not null unique,
  shelf       text,
  condition   text not null default 'good'
);
create index on public.book_copies (book_id);

create table public.book_loans (
  id           uuid primary key default gen_random_uuid(),
  copy_id      uuid not null references public.book_copies(id),
  borrower_id  uuid not null references public.profiles(id),
  issued_on    date not null default current_date,
  due_on       date not null,
  returned_on  date,
  fine_amount  numeric(8,2) not null default 0
);
create unique index book_one_open_loan on public.book_loans (copy_id) where returned_on is null;
create index on public.book_loans (borrower_id);

-- Transport --------------------------------------------------------------------
create table public.bus_routes (
  id      uuid primary key default gen_random_uuid(),
  code    text not null unique,
  name    text not null
);

create table public.bus_stops (
  id         uuid primary key default gen_random_uuid(),
  route_id   uuid not null references public.bus_routes(id) on delete cascade,
  name       text not null,
  seq        smallint not null,
  pickup_at  time not null,
  latitude   numeric(9,6),
  longitude  numeric(9,6),
  unique (route_id, seq)
);

create table public.buses (
  id            uuid primary key default gen_random_uuid(),
  registration  text not null unique,
  capacity      smallint not null,
  route_id      uuid references public.bus_routes(id),
  driver_name   text,
  driver_phone  text
);

create table public.bus_passes (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  stop_id     uuid not null references public.bus_stops(id),
  valid_from  date not null,
  valid_to    date not null
);
create index on public.bus_passes (profile_id);

create table public.bus_locations (
  bus_id      uuid primary key references public.buses(id) on delete cascade,
  latitude    numeric(9,6) not null,
  longitude   numeric(9,6) not null,
  recorded_at timestamptz not null default now()
);

-- Clubs, events, sports ------------------------------------------------------------
create table public.clubs (
  id               uuid primary key default gen_random_uuid(),
  name             text not null unique,
  category         text not null,          -- technical, cultural, social ...
  faculty_advisor  uuid references public.faculty(id),
  description      text
);

create table public.club_members (
  club_id     uuid not null references public.clubs(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  position    text not null default 'member',
  joined_on   date not null default current_date,
  primary key (club_id, student_id)
);
create index on public.club_members (student_id);

create table public.events (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  organiser_club_id uuid references public.clubs(id),
  room_id      uuid references public.rooms(id),
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  capacity     integer,
  check (ends_at > starts_at)
);
create index on public.events (starts_at);

create table public.event_registrations (
  event_id    uuid not null references public.events(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  registered_at timestamptz not null default now(),
  attended    boolean not null default false,
  primary key (event_id, profile_id)
);

create table public.sports_facilities (
  id        uuid primary key default gen_random_uuid(),
  name      text not null unique,
  sport     text not null,
  capacity  smallint
);

create table public.facility_bookings (
  id           uuid primary key default gen_random_uuid(),
  facility_id  uuid not null references public.sports_facilities(id) on delete cascade,
  booked_by    uuid not null references public.profiles(id),
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  check (ends_at > starts_at),
  exclude using gist (facility_id with =, tstzrange(starts_at, ends_at) with &&)
);

create table public.sports_achievements (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  sport       text not null,
  level       text not null check (level in ('intra', 'inter_college', 'state', 'national', 'international')),
  title       text not null,
  achieved_on date not null
);

-- Health centre ---------------------------------------------------------------
create table public.medical_visits (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.profiles(id),
  doctor_id    uuid references public.profiles(id),
  visited_at   timestamptz not null default now(),
  complaint    text not null,
  diagnosis    text,
  prescription text,
  follow_up_on date
);
create index on public.medical_visits (patient_id);

create table public.medicine_stock (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  quantity    integer not null default 0 check (quantity >= 0),
  reorder_at  integer not null default 20,
  expires_on  date
);

-- Visitor management -----------------------------------------------------------
create table public.visitors (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  phone       text not null,
  id_proof    text,
  purpose     text not null,
  host_id     uuid references public.profiles(id),
  checked_in_at  timestamptz not null default now(),
  checked_out_at timestamptz,
  logged_by   uuid references public.profiles(id)
);
create index on public.visitors (checked_in_at);
