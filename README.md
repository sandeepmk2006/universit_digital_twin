# EduBase

EduBase is a digital twin of a university. Students, faculty, rooms, timetables, attendance, exams, placements,
hostels, buses, the library, finances and grievances all live in one Postgres database. A web dashboard and a
small intelligence service sit on top of it.

The intelligence service:
- predicts student performance and flags students at risk,
- recommends electives,
- builds placement-preparation plans from skill gaps,
- assigns rooms to timetable slots with a constraint solver,
- answers campus questions through a chat assistant that reads the same data.

```
┌──────────────────────┐      ┌──────────────────────────┐
│  web/  (Next.js)     │─────▶│  Supabase                │
│  dashboards, auth    │      │  Postgres + RLS + Auth   │
└─────────┬────────────┘      │  pgvector knowledge base │
          │ /api/chat         └────────────▲─────────────┘
          │ /api/ml/*                      │ psycopg
          ▼                                │
┌──────────────────────┐                   │
│  ml/  (FastAPI)      │───────────────────┘
│  scikit-learn,       │
│  OR-Tools, Claude    │
└──────────────────────┘
```

## Repository layout

| Path | Contents |
|---|---|
| `supabase/migrations/` | Schema, row-level security, reporting views. Applied in filename order. |
| `supabase/seed/` | Synthetic campus: 2,040 students, 120 faculty, 93 rooms, one full term of attendance and marks. |
| `web/` | Next.js 15 dashboard (App Router, Tailwind, `@supabase/ssr`). |
| `ml/` | FastAPI service for predictions, recommendations, room allocation and the assistant. |

## Data model

The schema has 62 tables in six groups. Everything hangs off a few shared entities: `profiles` (one per auth user),
`students`, `faculty`, `departments`, `courses` and `rooms`.

| Area | Tables |
|---|---|
| Academics | `academic_terms`, `courses`, `course_sections`, `enrollments`, `timetable_slots`, `attendance_sessions`, `attendance_records`, `exams`, `marks` |
| People | `profiles`, `students`, `guardians`, `faculty`, `alumni`, `applicants` |
| Campus | `buildings`, `rooms`, `hostels`, `hostel_rooms`, `hostel_allocations`, `books`, `book_copies`, `book_loans`, `bus_routes`, `bus_stops`, `buses`, `bus_passes`, `clubs`, `events`, `sports_facilities`, `medical_visits`, `visitors` |
| Administration | `fee_structures`, `invoices`, `payments`, `scholarships`, `expenses`, `inventory_items`, `placement_drives`, `placement_applications`, `placement_offers`, `research_projects`, `publications`, `grievances`, `feedback_forms` |
| Intelligence | `performance_predictions`, `recommendations`, `room_allocation_runs`, `kb_documents`, `chat_sessions`, `chat_messages` |

The database enforces some invariants directly:
- **No room double-booking.** A GiST exclusion constraint on `timetable_slots` and `facility_bookings` rejects overlapping bookings.
- **One active hostel bed per student** and **one open loan per book copy**, each enforced with a partial unique index.

Reporting views (`v_dashboard_kpis`, `v_student_directory`, `v_timetable`, and others) run with
`security_invoker`, so they never bypass RLS.

### Access control

Row-level security is enabled on every table.

| Role | Can see |
|---|---|
| Student | Their own records (marks, attendance, invoices, medical visits, loans) and the shared catalogue (courses, rooms, events, routes) |
| Staff (faculty, HOD, warden, librarian, placement officer, …) | All operational records |
| Doctor | Medical visits |
| Admin | Everything, including role changes |

Role checks go through `security definer` helpers in a `private` schema, which is not exposed over the API.

## Getting started

### 1. Database

The schema and seed are already applied to the hosted project. To recreate them elsewhere:

```bash
supabase link --project-ref <your-ref>
supabase db push                          # migrations
psql "$DATABASE_URL" -f supabase/seed/01_structure.sql   # then 02 … 05 in order
```

Every seeded account uses the password `EduBase@2026`:

| Role | Email |
|---|---|
| Admin | `admin@edubase.edu` |
| Placement officer | `placements@edubase.edu` |
| Warden | `warden@edubase.edu` |
| Student | `abhishek.krishnan.23cse001@student.edubase.edu` |

All other students and faculty follow the pattern in `supabase/seed/02_people.sql`.

### 2. Web app

```bash
cd web
cp .env.example .env.local
npm install
npm run dev            # http://localhost:3000
```

### 3. Intelligence service

```bash
cd ml
python -m venv .venv && .venv/Scripts/activate   # or source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env   # DATABASE_URL, ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY
uvicorn edubase_ml.main:app --reload --port 8000
pytest -q
```

| Endpoint | Who | What |
|---|---|---|
| `POST /predict/performance` | staff | Builds per-student features and trains a gradient-boosted model on last term's grades (falls back to a weighted heuristic with too little data). Stores a predicted GPA, a risk band and per-feature contributions. |
| `POST /recommend/electives/{student_id}` | staff or that student | Hybrid recommender: tag overlap with the student's interests and strongest courses, plus electives chosen by students with similar grade vectors. |
| `POST /recommend/placement/{student_id}` | staff or that student | Skill gaps against upcoming eligible drives, weighted by package. |
| `POST /allocate/rooms/{term_id}` | staff | CP-SAT model that assigns every slot a room large enough for the enrolment and of the right kind, with no overlaps, minimising empty seats. |
| `POST /chat` | signed-in users | Claude with tool use. It answers from the knowledge base and from the caller's own attendance, timetable and results. |

## Status

- [x] Schema, RLS, seed data and reporting views (live on Supabase)
- [x] Dashboard for all 21 modules
- [x] Intelligence service with offline test suite
- [ ] Write paths in the UI (marking attendance, filing grievances) beyond what Supabase Studio provides
- [ ] Embeddings for the knowledge base (needs `VOYAGE_API_KEY`; full-text search is used until then)
