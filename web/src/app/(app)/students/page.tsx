import Link from "next/link";
import { Badge, DataTable, PageHeader, Pagination, SearchBox } from "@/components/ui";
import { formatPercent } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Row } from "@/types/db";

function riskTone(value: unknown) {
  return value === "high" ? "bad" : value === "medium" ? "warn" : "good";
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; department?: string; semester?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const q = params.q?.trim() ?? "";
  const pageSize = 15;
  const supabase = await createClient();
  let query = supabase
    .from("v_student_directory")
    .select("*", { count: "exact" })
    .range((page - 1) * pageSize, page * pageSize - 1)
    .order("full_name");
  if (q) query = query.or(`full_name.ilike.%${q}%,roll_no.ilike.%${q}%`);
  if (params.department) query = query.eq("department", params.department);
  if (params.semester) query = query.eq("current_semester", Number(params.semester));
  const { data, count } = await query;
  return (
    <>
      <PageHeader title="Students" description="Search and review the student registry." />
      <form className="mb-4 flex flex-wrap gap-2">
        <SearchBox placeholder="Name or roll number" value={q} />
        <input
          name="department"
          defaultValue={params.department}
          placeholder="Department"
          className="border border-[var(--line)] bg-[var(--panel)] px-3 text-sm"
        />
        <input
          name="semester"
          defaultValue={params.semester}
          type="number"
          min="1"
          placeholder="Semester"
          className="w-28 border border-[var(--line)] bg-[var(--panel)] px-3 text-sm"
        />
        <button className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white">
          Filter
        </button>
      </form>
      <DataTable
        rows={(data ?? []) as Row[]}
        columns={[
          {
            key: "roll_no",
            label: "Roll no.",
            render: (r) => (
              <Link className="font-medium text-indigo-600" href={`/students/${String(r.id)}`}>
                {String(r.roll_no)}
              </Link>
            ),
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
        empty="No students match this search."
      />
      <Pagination
        page={page}
        total={count ?? 0}
        pageSize={pageSize}
        basePath="/students"
        query={q}
      />
    </>
  );
}
