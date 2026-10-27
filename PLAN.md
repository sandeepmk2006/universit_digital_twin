# AI-Powered Digital Twin of a University — Project Plan

## 1. Goal
One connected system that holds every student, faculty member, room, lab, hostel, bus,
placement activity, attendance record, event, exam and resource, with AI features on top:
- Predict student performance
- Recommend electives
- Suggest placement preparation
- Optimize classroom allocation
- Answer campus questions through a chatbot

## 2. Tech Stack
| Layer | Choice | Why |
|---|---|---|
| Database / Auth / Storage | **Supabase (Postgres)** | Relational data, Row Level Security, auth, realtime, pgvector |
| Backend logic | Supabase Edge Functions + Python (FastAPI) ML service | Edge functions for CRUD and business rules, Python for ML |
| Frontend | Next.js (React) + Tailwind | Role-based dashboards |
| ML | scikit-learn / XGBoost | Performance prediction and recommendations |
| Optimization | Google OR-Tools | Classroom and timetable allocation |
| Chatbot | Claude API + pgvector (RAG) | Answers grounded in campus data |
| Charts | Recharts | Analytics dashboards |

## 3. Roles
Admin, Faculty, Student, HOD, Warden, Placement Officer, Librarian, Transport Manager,
Doctor (Health Centre), Security (Visitor), Alumni.

## 4. Database Design (core entities by module)
**Core (shared):** `users`, `roles`, `departments`, `programs`, `courses`, `semesters`,
`buildings`, `rooms` (type: classroom, lab, hall; capacity; equipment)

| Module | Key tables |
|---|---|
| Admissions | applicants, applications, admission_documents, merit_lists |
| Student Information | students, guardians, enrollments, academic_records |
| Attendance | attendance_sessions, attendance_records |
| Timetable | timetable_slots, course_sections, room_bookings |
| Faculty Workload | faculty, teaching_assignments, workload_summary (view) |
| Examinations | exams, exam_schedules, marks, results |
| Placements | companies, drives, applications, offers, student_skills |
| Library | books, book_copies, issues, reservations, fines |
| Hostel | hostels, hostel_rooms, allocations, mess, complaints |
| Clubs | clubs, club_members, club_activities |
| Events | events, registrations, venues (rooms) |
| Sports | sports, teams, facilities, bookings, achievements |
| Research | projects, publications, grants, patents |
| Alumni | alumni, employment_history, donations, mentorships |
| Finance | fee_structures, invoices, payments, scholarships, expenses |
| Inventory | items, stock, purchase_orders, asset_assignments |
| Transport | buses, routes, stops, bus_passes, trip_logs |
| Health Centre | medical_visits, prescriptions, medicine_stock |
| Visitor Management | visitors, visit_passes, gate_logs |
| Grievances | grievances, grievance_updates (status workflow) |
| Feedback | feedback_forms, questions, responses |
| AI | ml_predictions, recommendations, chat_sessions, chat_messages, kb_documents (vector embeddings) |

Principles: everything is linked through `users` / `students` / `faculty` / `rooms`, all IDs are UUIDs,
RLS policies per role, audit columns (`created_at`, `updated_by`), and indexes on foreign keys
and dates, since the dataset will be large.

## 5. AI Features
1. **Performance prediction:** inputs are attendance %, internal marks, assignment submissions,
   past GPA and library use. A classifier and regressor output a predicted grade and a risk level,
   and at-risk students are flagged for mentors.
2. **Elective recommendation:** hybrid of content-based matching (student strengths and interests
   vs. course tags) and collaborative filtering (choices made by similar alumni).
3. **Placement preparation:** compare a student's skills with past offers and company requirements,
   then output skill gaps, suggested courses and a mock-test plan.
4. **Classroom allocation:** constraint solver (OR-Tools) over room capacity, equipment,
   faculty availability and clashes. Uses real attendance numbers to avoid wasting large rooms.
5. **Campus chatbot:** RAG over policies, timetables, events, bus routes and FAQs. Personal queries
   ("my attendance?") go through tool calls to the database, filtered by RLS.

## 6. Phased Roadmap
| Phase | Weeks | Deliverables |
|---|---|---|
| 0. Setup | 1 | Repo, Supabase project, auth, roles, ER diagram |
| 1. Academic core | 2–4 | Students, faculty, courses, timetable, attendance, exams |
| 2. Campus life | 5–7 | Hostel, library, transport, clubs, events, sports, health, visitors |
| 3. Admin & finance | 8–9 | Admissions, finance, inventory, grievances, feedback, research, alumni, placements |
| 4. Data | 10 | Seed scripts with realistic synthetic data (10k+ students) |
| 5. AI | 11–13 | Prediction, recommenders, allocation optimizer, chatbot |
| 6. Digital-twin dashboard | 14 | Live campus view: room occupancy, bus status, alerts, KPIs |
| 7. Testing & docs | 15–16 | Tests, RLS checks, report, demo |

## 7. MVP (if time is short)
Students, Faculty, Courses, Timetable, Attendance, Exams, Placements, Hostel, Library,
plus 2 AI features (performance prediction and chatbot). Add other modules afterwards.

## 8. Deliverables
ER diagram, SQL migrations, web app, ML notebooks and models, chatbot, dashboard,
project report and presentation.
