"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyStudentId } from "@/lib/data";

export async function applyLeave(form: FormData) {
  const studentId = await getMyStudentId();
  if (!studentId) return { error: "Only students can apply for leave." };
  const get = (k: string) => String(form.get(k) ?? "").trim();
  if (get("to_date") < get("from_date"))
    return { error: "The end date must be on or after the start date." };
  const supabase = await createClient();
  const { error } = await supabase.from("leave_requests").insert({
    student_id: studentId,
    subject: get("subject"),
    leave_type: get("leave_type"),
    from_date: get("from_date"),
    to_date: get("to_date"),
    from_session: get("from_session") || "full_day",
    to_session: get("to_session") || "full_day",
    reason: get("reason") || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/me/leave");
  return { ok: true };
}

export async function requestService(service: string, purpose: string | null, fee: number) {
  const studentId = await getMyStudentId();
  if (!studentId) return { error: "Only students can raise service requests." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("service_requests")
    .insert({ student_id: studentId, service, purpose, fee });
  if (error) return { error: error.message };
  revalidatePath("/me/requests");
  return { ok: true };
}
