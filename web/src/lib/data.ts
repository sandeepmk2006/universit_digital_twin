import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

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
