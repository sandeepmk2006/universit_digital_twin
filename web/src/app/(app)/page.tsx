import Link from "next/link";
import { AttendanceChart } from "@/components/charts";
import { Badge, DataTable, PageHeader } from "@/components/ui";
import { formatDate, formatMoney, formatPercent, formatTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/data";
import { rowsFrom, type Row } from "@/types/db";
import type { ReactNode } from "react";

function toneForRisk(value: unknown) {
  return value === "high" ? "bad" : value === "medium" ? "warn" : "good";
}

async function StudentOverview({ email }: { email: string }) {
  const supabase = await createClient();
  const student = await supabase
    .from("v_student_directory")
    .select("*")
    .eq("email", email)
    .maybeSingle();
  if (!student.data)
    return <PageHeader title="Overview" description="Your student summary is not available yet." />;
  const row = student.data as Row;
  const weekday = new Date().getDay();
  const [timetable, invoices] = await Promise.all([
    supabase
      .from("v_timetable")
      .select("*")
      .eq("section_id", row.id)
      .eq("weekday", weekday)
      .order("starts_at"),
    supabase
      .from("v_invoice_ledger")
      .select("*")
      .eq("roll_no", String(row.roll_no))
      .order("due_on")
      .limit(5),
  ]);
  return (
    <>
      <PageHeader
        title={`Welcome, ${String(row.full_name).split(" ")[0]}`}
        description="Your academic and campus summary."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["Attendance", formatPercent(row.attendance_pct as number)],
            ["CGPA", row.cgpa ?? "—"],
            ["Predicted GPA", row.predicted_gpa ?? "—"],
            [
              "Risk",
              <Badge key="risk" tone={toneForRisk(row.risk_level)}>
                {String(row.risk_level ?? "not assessed")}
              </Badge>,
            ],
          ] as Array<[string, ReactNode]>
        ).map(([label, value]) => (
          <div key={String(label)} className="border border-[var(--line)] bg-[var(--panel)] p-4">
            <div className="text-xs text-[var(--muted)]">{String(label)}</div>
            <div className="mt-2 text-2xl font-semibold tabular">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="border border-[var(--line)] bg-[var(--panel)] p-5">
          <h2 className="font-medium">Today’s timetable</h2>
          <DataTable
            rows={(timetable.data ?? []) as Row[]}
            columns={[
              {
                key: "starts_at",
                label: "Time",
                render: (r) =>
                  `${formatTime(String(r.starts_at))}–${formatTime(String(r.ends_at))}`,
              },
              { key: "course_code", label: "Course" },
              { key: "room", label: "Room", render: (r) => String(r.room ?? "Unassigned") },
            ]}
            empty="No classes are scheduled today."
          />
        </section>
        <section className="border border-[var(--line)] bg-[var(--panel)] p-5">
          <h2 className="font-medium">Invoices</h2>
          <DataTable
            rows={(invoices.data ?? []) as Row[]}
            columns={[
              { key: "due_on", label: "Due", render: (r) => formatDate(String(r.due_on)) },
              { key: "amount", label: "Amount", render: (r) => formatMoney(r.amount as string) },
              {
                key: "status",
                label: "Status",
                render: (r) => (
                  <Badge tone={r.status === "paid" ? "good" : "warn"}>{String(r.status)}</Badge>
                ),
              },
            ]}
            empty="No invoices are recorded."
          />
        </section>
      </div>
    </>
  );
}

export default async function Overview() {
  const profile = await getProfile();
  if (profile?.role === "student") return <StudentOverview email={profile.email} />;
  const supabase = await createClient();
  const [{ data: kpi }, { data: departments }, { data: predictions }] = await Promise.all([
    supabase.from("v_dashboard_kpis").select("*").maybeSingle(),
    supabase
      .from("v_department_attendance")
      .select("*")
      .order("attendance_pct", { ascending: true }),
    supabase
      .from("performance_predictions")
      .select("id,predicted_gpa,risk_level,students(full_name)")
      .eq("risk_level", "high")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  const metrics: Array<[string, ReactNode]> = [
    ["Active students", kpi?.active_students],
    ["Active faculty", kpi?.active_faculty],
    ["Rooms", kpi?.rooms],
    ["Attendance", formatPercent(kpi?.attendance_pct)],
    ["Open grievances", kpi?.open_grievances],
    ["Upcoming events", kpi?.upcoming_events],
  ];
  return (
    <>
      <PageHeader
        title="Overview"
        description="A live read on the university’s operating health."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
        {metrics.map(([label, value]) => (
          <div key={String(label)} className="border border-[var(--line)] bg-[var(--panel)] p-4">
            <div className="text-xs text-[var(--muted)]">{label}</div>
            <div className="mt-2 text-2xl font-semibold tabular">{value ?? "—"}</div>
          </div>
        ))}
        <Link
          href="/allocation"
          className="border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950"
        >
          <div className="text-xs text-indigo-700 dark:text-indigo-300">Unassigned slots</div>
          <div className="mt-2 text-2xl font-semibold tabular text-indigo-700 dark:text-indigo-300">
            {String(kpi?.unassigned_slots ?? "—")}
          </div>
        </Link>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="border border-[var(--line)] bg-[var(--panel)] p-5">
          <h2 className="font-medium">Attendance by department</h2>
          <div className="mt-4">
            <AttendanceChart
              data={(departments ?? []).map((r) => ({
                name: String(r.name ?? r.department),
                value: Number(r.attendance_pct ?? 0),
              }))}
            />
          </div>
        </section>
        <section className="border border-[var(--line)] bg-[var(--panel)] p-5">
          <h2 className="font-medium">High-risk students</h2>
          <div className="mt-4">
            <DataTable
              rows={rowsFrom(predictions)}
              columns={[
                {
                  key: "students",
                  label: "Student",
                  render: (r) =>
                    String((r.students as { full_name?: string } | null)?.full_name ?? "Unknown"),
                },
                { key: "predicted_gpa", label: "GPA" },
                {
                  key: "risk_level",
                  label: "Risk",
                  render: (r) => <Badge tone="bad">{String(r.risk_level)}</Badge>,
                },
              ]}
              empty="No high-risk predictions are available."
            />
          </div>
        </section>
      </div>
    </>
  );
}
