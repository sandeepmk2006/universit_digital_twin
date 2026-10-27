import { createClient } from "@/lib/supabase/server";

export async function queryTable(
  table: string,
  columns = "*",
  page = 1,
  pageSize = 12,
  search?: string,
) {
  const supabase = await createClient();
  let query = supabase.from(table).select(columns, { count: "exact" });
  if (search) query = query.ilike("name", `%${search}%`);
  const from = (page - 1) * pageSize;
  const { data, count, error } = await query.range(from, from + pageSize - 1);
  return { data: data ?? [], count: count ?? 0, error };
}

export async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id,full_name,email,role")
    .eq("id", user.id)
    .single();
  return data;
}
