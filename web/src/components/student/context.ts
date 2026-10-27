import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTerm, getMyStudentId, requireModule } from "@/lib/data";
import type { Row } from "@/types/db";

// Everything a student page needs to render its header: who, what, which term.
export async function getStudentContext() {
  await requireModule("me");
  const id = await getMyStudentId();
  if (!id) redirect("/");
  const supabase = await createClient();
  const [{ data }, term] = await Promise.all([
    supabase
      .from("students")
      .select("*,programs(code,name,degree,departments(code,name))")
      .eq("id", id)
      .single(),
    getCurrentTerm(),
  ]);
  const s = data as Row;
  const p = s.programs as {
    code: string;
    name: string;
    degree: string;
    departments: { code: string };
  };
  const programme = `${p.degree} (${p.departments.code})`;
  return {
    id,
    supabase,
    student: s,
    programme,
    programmeName: p.name,
    term,
    subtitle: `${String(s.roll_no)}  |  ${programme}  |  Semester ${String(s.current_semester)}${term ? ` (${term.name} Semester)` : ""}`,
  };
}
