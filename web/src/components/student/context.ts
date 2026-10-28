import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTerm, getMyStudentId, requireModule } from "@/lib/data";
import type { Row } from "@/types/db";

export type Semester = { sem: number; termId: string; label: string };

// Selected semester from ?sem=, defaulting to the current one.
export function pickSemester(semesters: Semester[], sem?: string): Semester | undefined {
  return semesters.find((x) => x.sem === Number(sem)) ?? semesters[0];
}

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

  // The semesters this student has reached, newest first: semester k fell in the term
  // (current_semester - k) terms before the current one. A 4th-year sees 7, a fresher 1.
  const { data: allTerms } = await supabase
    .from("academic_terms")
    .select("id,name,starts_on,is_current")
    .order("starts_on");
  const termList = (allTerms ?? []) as { id: string; name: string; is_current: boolean }[];
  const curIdx = termList.findIndex((t) => t.is_current);
  const curSem = Number(s.current_semester);
  const semesters: Semester[] = [];
  for (let k = curSem; k >= 1; k--) {
    const t = termList[curIdx - (curSem - k)];
    if (t) semesters.push({ sem: k, termId: t.id, label: `Semester ${k} (${t.name} Semester)` });
  }

  return {
    id,
    supabase,
    student: s,
    programme,
    programmeName: p.name,
    term,
    semesters,
    subtitle: `${String(s.roll_no)}  |  ${programme}  |  Semester ${String(s.current_semester)}${term ? ` (${term.name} Semester)` : ""}`,
  };
}
