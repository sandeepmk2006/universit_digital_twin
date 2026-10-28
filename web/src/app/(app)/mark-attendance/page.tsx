import { ClipboardCheck } from "lucide-react";
import { Card, SectionHeader } from "@/components/section";
import { AttendanceForm } from "@/components/attendance-form";
import { createClient } from "@/lib/supabase/server";
import { getMyDepartment, getMyFacultyId, requireModule } from "@/lib/data";
import { formatDate } from "@/lib/format";

const PERIODS = ["09:00", "10:00", "11:15", "12:15", "14:00", "15:00", "16:00"];
const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const field = "rounded border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm";

type Section = { id: string; section: string; courses: { code: string; title: string } };

export default async function MarkAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; date?: string; slot?: string }>;
}) {
  const profile = await requireModule("mark-attendance");
  const sp = await searchParams;
  const supabase = await createClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  // Sections this person may mark: their own (faculty), their department's (HOD), all (admin).
  let q = supabase
    .from("course_sections")
    .select("id,section,courses!inner(code,title,department_id),academic_terms!inner(is_current)")
    .eq("academic_terms.is_current", true);
  if (profile?.role === "faculty") q = q.eq("faculty_id", (await getMyFacultyId()) ?? "");
  if (profile?.role === "hod") q = q.eq("courses.department_id", (await getMyDepartment())?.department_id ?? "");
  const { data: secData } = await q;
  const sections = ((secData ?? []) as unknown as Section[]).sort((a, b) =>
    `${a.courses.code}${a.section}`.localeCompare(`${b.courses.code}${b.section}`),
  );

  if (sections.length === 0)
    return (
      <>
        <SectionHeader icon={<ClipboardCheck size={22} />} title="Mark attendance" subtitle="No sections to mark this term." />
      </>
    );

  const section = sections.find((s) => s.id === sp.section) ?? sections[0];
  const date = sp.date && sp.date <= today ? sp.date : today;
  const weekday = new Date(`${date}T00:00:00`).getDay(); // 0 = Sunday
  const { data: slotData } = await supabase
    .from("v_timetable")
    .select("starts_at,ends_at,room")
    .eq("section_id", section.id)
    .eq("weekday", weekday === 0 ? 7 : weekday)
    .order("starts_at");
  const scheduled = (slotData ?? []).map((s) => ({ start: String(s.starts_at).slice(0, 5), room: s.room as string | null }));
  const hours = scheduled.length ? scheduled.map((s) => s.start) : PERIODS;
  const slot = sp.slot && hours.includes(sp.slot) ? sp.slot : hours[0];

  const [{ data: enrolled }, { data: session }] = await Promise.all([
    supabase.from("enrollments").select("students(id,roll_no,full_name)").eq("section_id", section.id),
    supabase
      .from("attendance_sessions")
      .select("id")
      .eq("section_id", section.id)
      .eq("held_on", date)
      .eq("starts_at", `${slot}:00`)
      .maybeSingle(),
  ]);
  const { data: existing } = session
    ? await supabase.from("attendance_records").select("student_id,status").eq("session_id", session.id)
    : { data: [] };
  const statusOf = new Map((existing ?? []).map((r) => [String(r.student_id), r.status]));
  const students = (enrolled ?? [])
    .map((e) => e.students as unknown as { id: string; roll_no: string; full_name: string })
    .filter(Boolean)
    .map((s) => ({ ...s, status: statusOf.get(s.id) }))
    .sort((a, b) => a.roll_no.localeCompare(b.roll_no));

  return (
    <>
      <SectionHeader
        icon={<ClipboardCheck size={22} />}
        title="Mark attendance"
        subtitle={`${section.courses.code} · ${section.courses.title} · Section ${section.section}`}
      />
      <Card title="Choose the class">
        <form className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1 font-medium">
            Section
            <select name="section" defaultValue={section.id} className={`${field} min-w-72`}>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.courses.code} · {s.courses.title} · {s.section}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-medium">
            Date
            <input type="date" name="date" defaultValue={date} max={today} className={field} />
          </label>
          <label className="flex flex-col gap-1 font-medium">
            Hour
            <select name="slot" defaultValue={slot} className={field}>
              {hours.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
          <button className="rounded border border-indigo-600 px-4 py-2 font-medium text-indigo-600 hover:bg-indigo-50">
            Load class
          </button>
        </form>
        <p className="mt-3 text-sm text-[var(--muted)]">
          {DAY[weekday]}, {formatDate(date)} ·{" "}
          {scheduled.length
            ? `Timetabled at ${scheduled.map((s) => `${s.start}${s.room ? ` (${s.room})` : ""}`).join(", ")}`
            : "No class is timetabled for this section on this day; choose the hour it was held."}
          {session ? " · Attendance already taken for this hour; you can update it." : ""}
        </p>
      </Card>
      <div className="mt-4">
        <Card title={`Students (${students.length})`}>
          <AttendanceForm
            key={`${section.id}-${date}-${slot}`}
            sectionId={section.id}
            heldOn={date}
            startsAt={`${slot}:00`}
            students={students}
            alreadyTaken={Boolean(session)}
          />
        </Card>
      </div>
    </>
  );
}
