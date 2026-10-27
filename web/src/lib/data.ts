import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Non-teaching and teaching staff see institution-wide records; students and
// alumni see only their own. The database enforces this with RLS; these helpers
// keep students out of staff-facing pages so they never land on an empty directory.
export const STAFF_ROLES = new Set([
  "admin",
  "faculty",
  "hod",
  "warden",
  "placement_officer",
  "librarian",
  "transport_manager",
  "doctor",
  "security",
  "accountant",
]);

// Generic modules a student is allowed to open: catalogues, RLS-scoped records,
// and "courses" so they can reach the detail of a course they're enrolled in.
export const STUDENT_MODULES = new Set([
  "library",
  "events",
  "clubs",
  "sports",
  "feedback",
  "courses",
]);

export function isStaff(role: string | null | undefined) {
  return !!role && STAFF_ROLES.has(role);
}

export async function queryTable(
  table: string,
  columns = "*",
  page = 1,
  pageSize = 12,
  search?: string,
) {
  const supabase = await createClient();
  let query = supabase.from(table).select(columns, { count: "estimated" });
  if (search) query = query.ilike("name", `%${search}%`);
  const from = (page - 1) * pageSize;
  const { data, count, error } = await query.range(from, from + pageSize - 1);
  return { data: data ?? [], count: count ?? 0, error };
}

// Cached per request: the layout and the page both need the profile.
export const getProfile = cache(async () => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id,full_name,email,role")
    .eq("id", userId)
    .single();
  return data;
});

// The caller's student row id, if they are a student.
export const getMyStudentId = cache(async () => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims.sub;
  if (!uid) return null;
  const { data } = await supabase.from("students").select("id").eq("profile_id", uid).maybeSingle();
  return data?.id ? String(data.id) : null;
});

// Send students away from staff-only pages. Call at the top of such a page.
export async function requireStaff() {
  const profile = await getProfile();
  if (!isStaff(profile?.role)) redirect("/");
  return profile;
}

// The academic term in progress, with the teaching week, for the header.
export const getCurrentTerm = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("academic_terms")
    .select("name,starts_on,ends_on")
    .eq("is_current", true)
    .maybeSingle();
  if (!data) return null;
  const start = new Date(String(data.starts_on)).getTime();
  const end = new Date(String(data.ends_on)).getTime();
  const now = Math.min(Math.max(Date.now(), start), end);
  const week = Math.floor((now - start) / (7 * 86400000)) + 1;
  const total = Math.ceil((end - start) / (7 * 86400000));
  return { name: String(data.name), week, total };
});
