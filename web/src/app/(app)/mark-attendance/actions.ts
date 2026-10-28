"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyFacultyId, getProfile } from "@/lib/data";

const STATUSES = ["present", "absent", "late", "excused"] as const;
type Mark = { studentId: string; status: (typeof STATUSES)[number] };

// Save one class hour's attendance. The session row is created or reused, then every
// student's mark is upserted; a database trigger keeps the attendance summary in step,
// so students, HODs and the admin see the change straight away.
export async function saveAttendance(sectionId: string, heldOn: string, startsAt: string, marks: Mark[]) {
  const profile = await getProfile();
  const role = String(profile?.role ?? "");
  if (!["faculty", "hod", "admin"].includes(role)) return { error: "Only teaching staff can mark attendance." };
  if (!marks.length) return { error: "There are no students to mark." };
  if (marks.some((m) => !STATUSES.includes(m.status))) return { error: "Unknown attendance status." };

  const supabase = await createClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const [{ data: term }, { data: section }, facultyId] = await Promise.all([
    supabase.from("academic_terms").select("starts_on,ends_on").eq("is_current", true).single(),
    supabase.from("course_sections").select("id,faculty_id").eq("id", sectionId).single(),
    getMyFacultyId(),
  ]);
  if (!section) return { error: "Section not found." };
  if (role === "faculty" && section.faculty_id !== facultyId)
    return { error: "You can only mark attendance for sections you teach." };
  if (heldOn > today) return { error: "Attendance cannot be marked for a future date." };
  if (term && (heldOn < term.starts_on || heldOn > term.ends_on))
    return { error: "The date is outside the current term." };

  const { data: session, error: sErr } = await supabase
    .from("attendance_sessions")
    .upsert(
      { section_id: sectionId, held_on: heldOn, starts_at: startsAt, taken_by: facultyId },
      { onConflict: "section_id,held_on,starts_at" },
    )
    .select("id")
    .single();
  if (sErr || !session) return { error: sErr?.message ?? "Could not create the class session." };

  const { error } = await supabase.from("attendance_records").upsert(
    marks.map((m) => ({ session_id: session.id, student_id: m.studentId, status: m.status })),
    { onConflict: "session_id,student_id" },
  );
  if (error) return { error: error.message };

  revalidatePath("/mark-attendance");
  const count = (s: string) => marks.filter((m) => m.status === s).length;
  return {
    ok: true,
    text: `Saved: ${count("present")} present, ${count("absent")} absent, ${count("late")} late, ${count("excused")} on duty.`,
  };
}
