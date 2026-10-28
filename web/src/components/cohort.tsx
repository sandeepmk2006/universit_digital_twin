// Student lists are never shown as one mixed registry: each list is split by year of
// study and then by department, and sorted by register number within that cohort.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export type Cohort = { year: number; dept: string; depts: string[] };
export type CohortColumns = { sem: string; dept: string };

const YEARS = [1, 2, 3, 4];
const ORDINAL = ["1st", "2nd", "3rd", "4th"];

// Departments that have at least one student the caller may see (row-level security
// decides, so a HOD or faculty member only gets their own departments).
async function visibleDepartments(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("departments").select("code").order("code");
  const codes = (data ?? []).map((d) => String(d.code));
  const counts = await Promise.all(
    codes.map(async (code) => {
      const { count } = await supabase
        .from("students")
        .select("id,programs!inner(departments!inner(code))", { count: "exact", head: true })
        .eq("programs.departments.code", code);
      return count ?? 0;
    }),
  );
  return codes.filter((_, i) => counts[i] > 0);
}

export async function resolveCohort(year?: string, dept?: string): Promise<Cohort> {
  const depts = await visibleDepartments();
  const y = Number(year);
  return {
    year: YEARS.includes(y) ? y : 1,
    dept: dept && depts.includes(dept) ? dept : (depts[0] ?? ""),
    depts,
  };
}

// Restrict a PostgREST query to one year (two semesters) and one department.
export function applyCohort<Q>(query: Q, c: Cohort, cols: CohortColumns): Q {
  return (query as any) // eslint-disable-line
    .gte(cols.sem, c.year * 2 - 1)
    .lte(cols.sem, c.year * 2)
    .eq(cols.dept, c.dept || "—");
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white"
          : "rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 py-1 text-xs text-[var(--muted)] hover:border-indigo-300 hover:text-indigo-600"
      }
    >
      {children}
    </Link>
  );
}

export function CohortBar({
  cohort,
  basePath,
  keep,
}: {
  cohort: Cohort;
  basePath: string;
  keep?: Record<string, string | undefined>;
}) {
  const href = (year: number, dept: string) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(keep ?? {})) if (v) sp.set(k, v);
    sp.set("year", String(year));
    sp.set("dept", dept);
    return `${basePath}?${sp.toString()}`;
  };
  if (cohort.depts.length === 0) return null;
  return (
    <div className="mb-4 space-y-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-24 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Year</span>
        {YEARS.map((y) => (
          <Chip key={y} href={href(y, cohort.dept)} active={y === cohort.year}>
            {ORDINAL[y - 1]} year
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-24 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Department</span>
        {cohort.depts.map((d) => (
          <Chip key={d} href={href(cohort.year, d)} active={d === cohort.dept}>
            {d}
          </Chip>
        ))}
      </div>
    </div>
  );
}
