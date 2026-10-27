-- Tables backing the AI features: predictions, recommendations, chatbot knowledge base.

create extension if not exists vector with schema extensions;

create table public.performance_predictions (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.students(id) on delete cascade,
  term_id          uuid references public.academic_terms(id),
  predicted_gpa    numeric(4,2) not null,
  risk_level       text not null check (risk_level in ('low', 'medium', 'high')),
  factors          jsonb not null default '{}',   -- feature contributions for explainability
  model_version    text not null,
  created_at       timestamptz not null default now()
);
create index on public.performance_predictions (student_id, created_at desc);

create table public.recommendations (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students(id) on delete cascade,
  kind         text not null check (kind in ('elective', 'placement_prep')),
  payload      jsonb not null,     -- elective: {course_id, score, reason}; prep: {skill, gap, resources}
  score        numeric(5,4),
  model_version text not null,
  created_at   timestamptz not null default now()
);
create index on public.recommendations (student_id, kind);

create table public.room_allocation_runs (
  id           uuid primary key default gen_random_uuid(),
  term_id      uuid not null references public.academic_terms(id),
  status       text not null default 'proposed' check (status in ('proposed', 'applied', 'discarded')),
  objective    numeric,
  assignments  jsonb not null,     -- [{slot_id, room_id}]
  created_at   timestamptz not null default now()
);

create table public.kb_documents (
  id          uuid primary key default gen_random_uuid(),
  source      text not null,          -- 'handbook', 'faq', 'policy', ...
  title       text not null,
  content     text not null,
  embedding   extensions.vector(1024),
  updated_at  timestamptz not null default now()
);
create index on public.kb_documents using hnsw (embedding extensions.vector_cosine_ops);

create table public.chat_sessions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.chat_messages (
  id          bigint generated always as identity primary key,
  session_id  uuid not null references public.chat_sessions(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);
create index on public.chat_messages (session_id, id);

create or replace function public.match_kb_documents(query_embedding extensions.vector(1024), match_count int default 5)
returns table (id uuid, title text, content text, similarity float)
language sql stable
set search_path = ''
as $$
  select d.id, d.title, d.content, 1 - (d.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.kb_documents d
  where d.embedding is not null
  order by d.embedding operator(extensions.<=>) query_embedding
  limit match_count;
$$;
