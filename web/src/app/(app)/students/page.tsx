import { Users } from "lucide-react";
import { Badge, DataTable, Pagination, SearchBox } from "@/components/ui";
import { SectionHeader } from "@/components/section";
import { canWrite } from "@/lib/permissions";
import { AddButton } from "@/components/record-actions";
import { formatPercent } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { type Row } from "@/types/db";
import { requireModule } from "@/lib/data";
import { applyCohort, CohortBar, resolveCohort } from "@/components/cohort";

function riskTone(value: unknown) {
  return value === "high" ? "bad" : value === "medium" ? "warn" : "good";
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    year?: string;
    dept?: string;
    tab?: string;
  }>;
}) {
  const profile = await requireModule("students");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const q = params.q?.trim() ?? "";
  const pageSize = 15;
  const supabase = await createClient();

  // Row-level security limits faculty to the students they teach or mentor, a HOD to
  // their department and a warden to their hostel; the list then shows one year and
  // one department at a time, in register-number order.
  const scoped = profile?.role === "faculty";
  const cohort = await resolveCohort(params.year, params.dept);

  let query = supabase
    .from("v_student_directory")
    .select("id,roll_no,full_name,department,current_semester,attendance_pct,risk_level,status", {
      count: "exact",
    })
    .range((page - 1) * pageSize, page * pageSize - 1)
    .order("roll_no");
  query = applyCohort(query, cohort, { sem: "current_semester", dept: "department" });
  if (q) query = query.or(`full_name.ilike.%${q}%,roll_no.ilike.%${q}%`);
  const tab = params.tab ?? "all";
  if (tab === "risk") query = query.in("risk_level", ["high", "medium"]);
  if (tab === "shortage") query = query.lt("attendance_pct", 75);
  const { data, count } = await query;
  const tabs = [
    { key: "all", label: scoped ? "My students" : "All students" },
    { key: "risk", label: "At risk" },
    { key: "shortage", label: "Attendance shortage" },
  ];
  return (
    <>
      <SectionHeader
        icon={<Users size={22} />}
        title={scoped ? "My students" : "Students"}
        subtitle={`${scoped ? "Students you teach or mentor" : "Student registry"} · ${count ?? 0} records`}
        action={
          canWrite(profile?.role, "students") ? (
            <AddButton module="students" label="student" />
          ) : undefined
        }
        tabs={tabs}
        activeTab={tab}
        baseHref="/students"
      />
      <CohortBar
        cohort={cohort}
        basePath="/students"
        keep={{ tab: tab === "all" ? undefined : tab }}
      />
      <form className="mb-4 flex flex-wrap gap-2">
        {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
        <input type="hidden" name="year" value={cohort.year} />
        <input type="hidden" name="dept" value={cohort.dept} />
        <SearchBox placeholder="Name or register number" value={q} />
        <button className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white">
          Search
        </button>
      </form>
      <DataTable
        rows={(data ?? []) as Row[]}
        columns={[
          {
            key: "roll_no",
            label: "Reg. no.",
            render: (r) => <span className="font-medium text-indigo-600">{String(r.roll_no)}</span>,
          },
          { key: "full_name", label: "Student" },
          { key: "department", label: "Department" },
          { key: "current_semester", label: "Sem." },
          {
            key: "attendance_pct",
            label: "Attendance",
            render: (r) => (
              <span className={Number(r.attendance_pct) < 75 ? "font-medium text-rose-600" : ""}>
                {formatPercent(r.attendance_pct as number)}
              </span>
            ),
          },
          {
            key: "risk_level",
            label: "Risk",
            render: (r) => (
              <Badge tone={riskTone(r.risk_level)}>{String(r.risk_level ?? "not assessed")}</Badge>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (r) => (
              <Badge tone={r.status === "active" ? "good" : "neutral"}>{String(r.status)}</Badge>
            ),
          },
        ]}
        rowHref={(row) => `/students/${String(row.id)}`}
        empty="No students match this search."
      />
      <Pagination
        page={page}
        total={count ?? 0}
        pageSize={pageSize}
        basePath="/students"
        query={q}
        extra={{
          ...(tab === "all" ? {} : { tab }),
          year: String(cohort.year),
          dept: cohort.dept,
        }}
      />
    </>
  );
}
