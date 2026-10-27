-- Admissions, placements, research, alumni, finance, inventory, grievances, feedback.

-- Admissions -------------------------------------------------------------------
create table public.applicants (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null,
  email        citext not null,
  phone        text not null,
  program_id   uuid not null references public.programs(id),
  entrance_score numeric(6,2),
  board_percentage numeric(5,2),
  category     text,
  status       text not null default 'submitted'
    check (status in ('submitted', 'shortlisted', 'offered', 'accepted', 'rejected', 'withdrawn')),
  applied_at   timestamptz not null default now(),
  student_id   uuid references public.students(id),   -- set once admitted
  unique (email, program_id)
);
create index on public.applicants (program_id, status);

-- Placements ---------------------------------------------------------------------
create table public.companies (
  id        uuid primary key default gen_random_uuid(),
  name      text not null unique,
  sector    text,
  website   text
);

create table public.placement_drives (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id),
  role_title      text not null,
  package_lpa     numeric(6,2),
  min_cgpa        numeric(4,2) not null default 0,
  required_skills text[] not null default '{}',
  eligible_programs uuid[] not null default '{}',
  drive_date      date not null,
  status          text not null default 'upcoming' check (status in ('upcoming', 'ongoing', 'completed'))
);
create index on public.placement_drives (drive_date);

create table public.student_skills (
  student_id  uuid not null references public.students(id) on delete cascade,
  skill       text not null,
  level       smallint not null check (level between 1 and 5),
  primary key (student_id, skill)
);

create table public.placement_applications (
  id          uuid primary key default gen_random_uuid(),
  drive_id    uuid not null references public.placement_drives(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  stage       text not null default 'applied'
    check (stage in ('applied', 'shortlisted', 'test', 'interview', 'offered', 'rejected')),
  updated_at  timestamptz not null default now(),
  unique (drive_id, student_id)
);
create index on public.placement_applications (student_id);

create table public.placement_offers (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null unique references public.placement_applications(id) on delete cascade,
  package_lpa     numeric(6,2) not null,
  offered_on      date not null,
  accepted        boolean
);

-- Research -----------------------------------------------------------------------
create table public.research_projects (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  lead_faculty_id uuid not null references public.faculty(id),
  funding_agency  text,
  grant_amount    numeric(12,2),
  starts_on       date not null,
  ends_on         date,
  status          text not null default 'active' check (status in ('proposed', 'active', 'completed'))
);

create table public.publications (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  venue       text not null,
  kind        text not null check (kind in ('journal', 'conference', 'book_chapter', 'patent')),
  year        smallint not null,
  doi         text unique,
  project_id  uuid references public.research_projects(id)
);

create table public.publication_authors (
  publication_id uuid not null references public.publications(id) on delete cascade,
  faculty_id     uuid references public.faculty(id),
  student_id     uuid references public.students(id),
  position       smallint not null,
  primary key (publication_id, position),
  check (faculty_id is not null or student_id is not null)
);

-- Alumni -------------------------------------------------------------------------
create table public.alumni (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid unique references public.students(id),
  profile_id      uuid unique references public.profiles(id),
  full_name       text not null,
  graduation_year smallint not null,
  program_id      uuid references public.programs(id),
  current_company text,
  job_title       text,
  city            text,
  open_to_mentor  boolean not null default false
);

-- Finance ------------------------------------------------------------------------
create table public.fee_structures (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.programs(id),
  term_id     uuid not null references public.academic_terms(id),
  component   text not null,          -- tuition, hostel, transport, exam ...
  amount      numeric(10,2) not null check (amount >= 0),
  unique (program_id, term_id, component)
);

create table public.invoices (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  term_id     uuid not null references public.academic_terms(id),
  amount      numeric(10,2) not null,
  due_on      date not null,
  status      text not null default 'unpaid' check (status in ('unpaid', 'partial', 'paid', 'waived')),
  created_at  timestamptz not null default now()
);
create index on public.invoices (student_id);
create index on public.invoices (status, due_on);

create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices(id) on delete cascade,
  amount      numeric(10,2) not null check (amount > 0),
  method      text not null check (method in ('upi', 'card', 'netbanking', 'cash', 'cheque')),
  reference   text,
  paid_at     timestamptz not null default now()
);
create index on public.payments (invoice_id);

create table public.scholarships (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  name        text not null,
  amount      numeric(10,2) not null,
  term_id     uuid references public.academic_terms(id)
);

create table public.expenses (
  id             uuid primary key default gen_random_uuid(),
  department_id  uuid references public.departments(id),
  category       text not null,
  amount         numeric(12,2) not null,
  spent_on       date not null,
  notes          text
);

-- Inventory ---------------------------------------------------------------------
create table public.inventory_items (
  id          uuid primary key default gen_random_uuid(),
  sku         text not null unique,
  name        text not null,
  category    text not null,
  unit        text not null default 'pcs',
  quantity    integer not null default 0 check (quantity >= 0),
  reorder_at  integer not null default 0,
  room_id     uuid references public.rooms(id)
);

create table public.inventory_movements (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.inventory_items(id) on delete cascade,
  delta       integer not null,
  reason      text not null,
  moved_by    uuid references public.profiles(id),
  moved_at    timestamptz not null default now()
);

-- Grievances & feedback -----------------------------------------------------------
create table public.grievances (
  id           uuid primary key default gen_random_uuid(),
  raised_by    uuid not null references public.profiles(id),
  category     text not null check (category in ('academic', 'hostel', 'transport', 'finance', 'harassment', 'infrastructure', 'other')),
  subject      text not null,
  details      text not null,
  is_anonymous boolean not null default false,
  status       text not null default 'open' check (status in ('open', 'assigned', 'in_progress', 'resolved', 'closed')),
  assigned_to  uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index on public.grievances (status, category);

create table public.grievance_updates (
  id            uuid primary key default gen_random_uuid(),
  grievance_id  uuid not null references public.grievances(id) on delete cascade,
  author_id     uuid not null references public.profiles(id),
  note          text not null,
  created_at    timestamptz not null default now()
);

create table public.feedback_forms (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  section_id  uuid references public.course_sections(id),   -- null = campus-wide
  questions   jsonb not null,           -- [{ "id": "q1", "text": "...", "type": "rating" }]
  opens_at    timestamptz not null,
  closes_at   timestamptz not null
);

create table public.feedback_responses (
  form_id       uuid not null references public.feedback_forms(id) on delete cascade,
  respondent_id uuid not null references public.profiles(id),
  answers       jsonb not null,
  submitted_at  timestamptz not null default now(),
  primary key (form_id, respondent_id)
);
