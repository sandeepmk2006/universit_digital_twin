"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/data";
import { canWrite, WRITABLE } from "@/lib/permissions";

// Turn a submitted form into a typed row following the module's field spec.
function buildPayload(module: string, form: FormData) {
  const spec = WRITABLE[module];
  const row: Record<string, unknown> = {};
  for (const f of spec.fields) {
    const raw = form.get(f.name);
    const s = typeof raw === "string" ? raw.trim() : "";
    if (s === "") {
      row[f.name] = f.required ? "" : null;
      continue;
    }
    if (f.type === "number") row[f.name] = Number(s);
    else if (f.type === "tags")
      row[f.name] = s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    else row[f.name] = s;
  }
  return row;
}

function friendly(error: { code?: string; message: string }) {
  if (error.code === "23505")
    return "Another record already uses this value (register number, email or code). Use a unique one.";
  if (error.code === "23514") return "One of the values is outside the allowed range.";
  return error.message;
}

async function guard(module: string) {
  if (!WRITABLE[module]) throw new Error("Unknown module");
  const profile = await getProfile();
  if (!canWrite(profile?.role, module)) redirect(`/${module}`);
  return createClient();
}

export async function createRecord(module: string, form: FormData) {
  const supabase = await guard(module);
  const spec = WRITABLE[module];
  const { data, error } = await supabase
    .from(spec.table)
    .insert(buildPayload(module, form))
    .select("id")
    .single();
  if (error) return { error: friendly(error) };
  revalidatePath(`/${module}`);
  redirect(`/${module}/${data.id}`);
}

export async function updateRecord(module: string, id: string, form: FormData) {
  const supabase = await guard(module);
  const spec = WRITABLE[module];
  const { error } = await supabase.from(spec.table).update(buildPayload(module, form)).eq("id", id);
  if (error) return { error: friendly(error) };
  revalidatePath(`/${module}/${id}`);
  redirect(`/${module}/${id}`);
}

export async function deleteRecord(module: string, id: string) {
  const supabase = await guard(module);
  const spec = WRITABLE[module];
  const { error } = await supabase.from(spec.table).delete().eq("id", id);
  if (error) {
    return {
      error:
        error.code === "23503"
          ? `This ${spec.label} is still linked to other records (for example sections, loans or bookings). Reassign or remove those first.`
          : error.message,
    };
  }
  revalidatePath(`/${module}`);
  redirect(`/${module}`);
}

// --- Real operations (not record edits) --------------------------------------

export async function checkOutVisitor(id: string) {
  const profile = await getProfile();
  if (profile?.role !== "admin" && profile?.role !== "security") redirect("/visitors");
  const supabase = await createClient();
  await supabase.from("visitors").update({ checked_out_at: new Date().toISOString() }).eq("id", id);
  revalidatePath(`/visitors/${id}`);
}

export async function returnBook(id: string) {
  const profile = await getProfile();
  if (profile?.role !== "admin" && profile?.role !== "librarian") redirect("/library");
  const supabase = await createClient();
  await supabase
    .from("book_loans")
    .update({ returned_on: new Date().toISOString().slice(0, 10) })
    .eq("id", id);
  revalidatePath(`/library/${id}`);
}

export async function setComplaintStatus(id: string, status: string) {
  const profile = await getProfile();
  if (profile?.role !== "admin" && profile?.role !== "warden") redirect("/hostel");
  const supabase = await createClient();
  await supabase.from("hostel_complaints").update({ status }).eq("id", id);
  revalidatePath(`/hostel`);
}
