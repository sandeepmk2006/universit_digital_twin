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
