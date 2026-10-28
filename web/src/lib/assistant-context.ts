// Live context for the assistant, built per role from the caller's own session, so
// row-level security bounds what the model can ever see.
import { createClient } from "@/lib/supabase/server";
import { getCurrentTerm, getMyFacultyId, getMyStudentId, getProfile } from "@/lib/data";

type Db = Awaited<ReturnType<typeof createClient>>;
type Rows = Record<string, unknown>[];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const table = (title: string, rows: Rows | null | undefined, cols: string[]) => {
  if (!rows?.length) return `${title}: none.`;
  const line = (r: Record<string, unknown>) => cols.map((c) => String(r[c] ?? "—")).join(" | ");
  return `${title} (${cols.join(" | ")}):\n${rows.map(line).join("\n")}`;
};
const hm = (t: unknown) => String(t ?? "").slice(0, 5);

function timetableRows(rows: Rows) {
  return rows
    .map((r) => ({
      day: DAYS[Number(r.weekday) - 1],
      time: `${hm(r.starts_at)}-${hm(r.ends_at)}`,
      course: `${String(r.course_code)} ${String(r.course_title)}`,
      room: r.room ?? "TBA",
      faculty: r.faculty,
      class: `${String(r.department)} sem ${String(r.semester)} ${String(r.section)}`,
      _o: Number(r.weekday) * 10000 + Number(hm(r.starts_at).replace(":", "")),
    }))
    .sort((a, b) => a._o - b._o);
}

async function studentContext(db: Db) {
  const sid = await getMyStudentId();
  if (!sid) return [];
  const [{ data: me }, { data: enr }] = await Promise.all([
    db
      .from("v_student_directory")
      .select("roll_no,full_name,department,program_code,current_semester,cgpa,attendance_pct,predicted_gpa,risk_level")
      .eq("id", sid)
      .maybeSingle(),
    db
      .from("enrollments")
      .select("section_id,course_sections!inner(academic_terms!inner(is_current),courses(code,title,credits))")
      .eq("student_id", sid)
      .eq("course_sections.academic_terms.is_current", true),
  ]);
  const sections = (enr ?? []).map((e) => String(e.section_id));
  const course = (id: unknown) =>
    (enr ?? []).find((e) => e.section_id === id)?.course_sections as unknown as {
      courses: { code: string; title: string; credits: number };
    };
  const [tt, att, marks, exams, inv, hostel, leave] = await Promise.all([
    db.from("v_timetable").select("weekday,starts_at,ends_at,course_code,course_title,room,faculty,department,semester,section").in("section_id", sections),
    db.from("v_student_attendance").select("section_id,sessions,attended,percentage").eq("student_id", sid).in("section_id", sections),
    db.from("marks").select("obtained,exams!inner(kind,max_marks,section_id)").eq("student_id", sid).in("exams.section_id", sections),
    db.from("exams").select("kind,held_on,section_id").in("section_id", sections).gte("held_on", new Date().toISOString().slice(0, 10)).order("held_on"),
    db.from("invoices").select("amount,due_on,status,academic_terms!inner(is_current),payments(amount)").eq("student_id", sid).eq("academic_terms.is_current", true),
    db.from("hostel_allocations").select("hostel_rooms(room_no,hostels(name))").eq("student_id", sid).is("to_date", null),
    db.from("leave_requests").select("leave_type,from_date,to_date,status").eq("student_id", sid).order("from_date", { ascending: false }).limit(5),
  ]);
  const lines = [
    `Student: ${JSON.stringify(me)}`,
    table("Registered courses this semester", (enr ?? []).map((e) => course(e.section_id)?.courses as unknown as Record<string, unknown>), ["code", "title", "credits"]),
    table("Weekly class timetable", timetableRows((tt.data ?? []) as Rows), ["day", "time", "course", "room", "faculty"]),
    table("Attendance by course", (att.data ?? []).map((a) => ({ ...a, course: course(a.section_id)?.courses.code })), ["course", "attended", "sessions", "percentage"]),
    table("Marks so far", (marks.data ?? []).map((m) => {
      const e = m.exams as unknown as { kind: string; max_marks: number; section_id: string };
      return { course: course(e.section_id)?.courses.code, test: e.kind, scored: m.obtained, out_of: e.max_marks };
    }), ["course", "test", "scored", "out_of"]),
    table("Upcoming assessments", (exams.data ?? []).map((e) => ({ ...e, course: course(e.section_id)?.courses.code })), ["held_on", "course", "kind"]),
    "End-semester examinations: 1-11 December 2026 (one paper a day, no Sundays). Students need at least 75% attendance to write them.",
    "Marks scheme: three internals of 40 converted to 15 each, assignment to 10, attendance 5 (>=95%), 4 (>=90%), 3 (>=85%), 2 (>=80%), 1 (<80%); end semester 100 converted to 40; total 100.",
    table("Current fee invoice", inv.data as Rows, ["amount", "due_on", "status"]),
    `Hostel: ${JSON.stringify(hostel.data?.[0]?.hostel_rooms ?? "day scholar")}`,
    table("Recent leave requests", leave.data as Rows, ["leave_type", "from_date", "to_date", "status"]),
  ];
  return lines;
}

async function facultyContext(db: Db) {
  const fid = await getMyFacultyId();
  if (!fid) return [];
  const { data: secs } = await db
    .from("course_sections")
    .select("id,section,courses(code,title),academic_terms!inner(is_current)")
    .eq("faculty_id", fid)
    .eq("academic_terms.is_current", true);
  const ids = (secs ?? []).map((s) => String(s.id));
  const [tt, risk, leave] = await Promise.all([
    db.from("v_timetable").select("weekday,starts_at,ends_at,course_code,course_title,room,faculty,department,semester,section").in("section_id", ids),
    db.from("v_student_directory").select("roll_no,full_name,attendance_pct,risk_level").in("risk_level", ["high", "medium"]).order("roll_no").limit(40),
    db.from("leave_requests").select("leave_type,from_date,to_date,status,students(roll_no,full_name)").eq("status", "pending").limit(20),
  ]);
  return [
    table("My teaching timetable", timetableRows((tt.data ?? []) as Rows), ["day", "time", "course", "class", "room"]),
    table("My students at risk (mentees and students taught)", risk.data as Rows, ["roll_no", "full_name", "attendance_pct", "risk_level"]),
    table("Pending leave requests I can review", (leave.data ?? []).map((l) => ({ ...l, student: JSON.stringify(l.students) })), ["student", "leave_type", "from_date", "to_date"]),
  ];
}

async function countOf(db: Db, t: string, f?: (q: any) => any) { // eslint-disable-line
  let q: any = db.from(t).select("*", { count: "exact", head: true }); // eslint-disable-line
  if (f) q = f(q);
  return (await q).count ?? 0;
}

async function officeContext(db: Db, role: string) {
  const out: string[] = [];
  if (["admin", "hod"].includes(role)) {
    const [{ data: dept }, high, shortage] = await Promise.all([
      db.from("v_department_attendance").select("*"),
      countOf(db, "v_student_directory", (q) => q.eq("risk_level", "high")),
      countOf(db, "v_student_directory", (q) => q.lt("attendance_pct", 75)),
    ]);
    out.push(table("Attendance by department", dept as Rows, Object.keys(dept?.[0] ?? {})));
    out.push(`Students at high risk: ${high}. Students below 75% attendance: ${shortage}.`);
  }
  if (["admin", "warden"].includes(role)) {
    const { data: h } = await db.from("hostels").select("name,gender,capacity");
    out.push(table("Residences", h as Rows, ["name", "gender", "capacity"]));
    out.push(`Current residents: ${await countOf(db, "hostel_allocations", (q) => q.is("to_date", null))}. Open complaints: ${await countOf(db, "hostel_complaints", (q) => q.in("status", ["open", "in_progress"]))}.`);
  }
  if (["admin", "accountant"].includes(role)) {
    out.push(`Invoices unpaid: ${await countOf(db, "invoices", (q) => q.eq("status", "unpaid"))}, partial: ${await countOf(db, "invoices", (q) => q.eq("status", "partial"))}.`);
  }
  if (["admin", "librarian"].includes(role)) {
    out.push(`Books on loan: ${await countOf(db, "book_loans", (q) => q.is("returned_on", null))}.`);
  }
  if (["admin", "placement_officer"].includes(role)) {
    const { data: d } = await db.from("placement_drives").select("role_title,drive_date,status,package_lpa,companies(name)").order("drive_date", { ascending: false }).limit(10);
    out.push(table("Recent placement drives", (d ?? []).map((x) => ({ ...x, company: (x.companies as unknown as { name: string })?.name })), ["company", "role_title", "drive_date", "status", "package_lpa"]));
  }
  if (["admin", "hod", "warden", "accountant", "transport_manager"].includes(role)) {
    out.push(`Grievances open for my office: ${await countOf(db, "grievances", (q) => q.in("status", ["open", "assigned", "in_progress"]))}.`);
  }
  return out;
}

export async function assistantContext(page?: string) {
  const db = await createClient();
  const [profile, term] = await Promise.all([getProfile(), getCurrentTerm()]);
  if (!profile) return null;
  const now = new Date();
  const today = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  const time = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
  const role = String(profile.role);
  const [roleLines, { data: kb }] = await Promise.all([
    role === "student" ? studentContext(db) : role === "faculty" ? facultyContext(db) : officeContext(db, role),
    db.from("kb_documents").select("title,content").limit(40),
  ]);
  return [
    `Today is ${today}, ${time} IST. Current term: ${term?.name ?? "unknown"} semester, week ${term?.week ?? "?"} of ${term?.total ?? "?"} (classes 20 July to 27 November 2026).`,
    `User: ${profile.full_name} (${profile.email}), role: ${role}.${page ? ` Currently viewing: ${page}.` : ""}`,
    ...roleLines,
    `University handbook:\n${(kb ?? []).map((d) => `## ${d.title}\n${d.content}`).join("\n\n")}`,
  ].join("\n\n");
}

// A student's course for the study assistant (only their own registered courses).
export async function studyCourse(sectionId: string) {
  const db = await createClient();
  const sid = await getMyStudentId();
  if (!sid) return null;
  const { data } = await db
    .from("enrollments")
    .select("course_sections!inner(id,courses(code,title,credits,description,tags))")
    .eq("student_id", sid)
    .eq("section_id", sectionId)
    .maybeSingle();
  return (data?.course_sections as unknown as { courses: { code: string; title: string; credits: number; description?: string; tags?: string[] } })?.courses ?? null;
}
