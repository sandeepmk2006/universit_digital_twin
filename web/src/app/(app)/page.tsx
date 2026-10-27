import Link from "next/link";
import { GraduationCap, LayoutDashboard } from "lucide-react";
import { AttendanceChart } from "@/components/charts";
import { Badge, DataTable, PageHeader } from "@/components/ui";
import { Card, SectionHeader, StatBox, StatRow } from "@/components/section";
import { formatDate, formatMoney, formatPercent, formatTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTerm, getMyFacultyId, getProfile } from "@/lib/data";
import {
  AlumniDashboard,
  FacultyDashboard,
  FinanceDashboard,
  HealthDashboard,
  HodDashboard,
  LibraryDashboard,
  PlacementDashboard,
  SecurityDashboard,
  TransportDashboard,
  WardenDashboard,
} from "@/components/role-dashboards";
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
  const term = await getCurrentTerm();
  // Postgres weekdays are Mon=1..Sat=6; JS getDay() is Sun=0.
  const weekday = new Date().getDay() || 7;
  const { data: enrolled } = await supabase
    .from("enrollments")
    .select("section_id")
    .eq("student_id", String(row.id));
  const sectionIds = rowsFrom(enrolled).map((r) => String(r.section_id));
  const [timetable, invoices] = await Promise.all([
    supabase
      .from("v_timetable")
      .select("id,section_id,starts_at,ends_at,course_code,course_title,room")
      .in("section_id", sectionIds)
      .eq("is_current", true)
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
      <SectionHeader
        icon={<GraduationCap size={22} />}
        title={`Welcome, ${String(row.full_name).split(" ")[0]}`}
        subtitle={`${String(row.roll_no)}  ·  ${String(row.program_code)} (${String(row.department)})  ·  Semester ${String(row.current_semester)}${term ? ` (${term.name})` : ""}`}
        action={
          <Link
            href={`/students/${String(row.id)}`}
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
          >
            View full record
          </Link>
        }
      />
      <StatRow>
        <StatBox
          label="Class Attendance"
          value={formatPercent(row.attendance_pct as number)}
          tone="green"
        />
        <StatBox label="CGPA" value={row.cgpa ?? "—"} tone="green" />
        <StatBox label="Predicted GPA" value={row.predicted_gpa ?? "—"} />
        <StatBox
          label="Performance Risk"
          value={
            <Badge tone={toneForRisk(row.risk_level)}>{String(row.risk_level ?? "n/a")}</Badge>
          }
          tone="amber"
        />
      </StatRow>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Today's classes">
          <DataTable
            rows={(timetable.data ?? []) as Row[]}
            rowHref={(r) => `/courses/${String(r.section_id)}`}
            columns={[
              {
                key: "starts_at",
                label: "Time",
                render: (r) =>
                  `${formatTime(String(r.starts_at))}–${formatTime(String(r.ends_at))}`,
              },
              {
                key: "course_code",
                label: "Course",
                render: (r) => `${String(r.course_code)} · ${String(r.course_title)}`,
              },
              { key: "room", label: "Room", render: (r) => String(r.room ?? "Unassigned") },
            ]}
            empty="No classes are scheduled today."
          />
        </Card>
        <Card title="Fee invoices">
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
        </Card>
      </div>
    </>
  );
}

export default async function Overview() {
  const profile = await getProfile();
  const role = profile?.role;
  if (role === "student") return <StudentOverview email={profile!.email} />;
  if (role === "faculty") {
    const facultyId = await getMyFacultyId();
    return facultyId ? (
      <FacultyDashboard facultyId={facultyId} name={profile!.full_name} />
    ) : (
      <PageHeader
        title="Overview"
        description="No teaching record is linked to your account yet."
      />
    );
  }
  if (role === "hod") return <HodDashboard />;
  if (role === "warden") return <WardenDashboard />;
  if (role === "placement_officer") return <PlacementDashboard />;
  if (role === "librarian") return <LibraryDashboard />;
  if (role === "transport_manager") return <TransportDashboard />;
  if (role === "doctor") return <HealthDashboard />;
  if (role === "security") return <SecurityDashboard />;
  if (role === "accountant") return <FinanceDashboard />;
  if (role === "alumni") return <AlumniDashboard name={profile!.full_name} />;
  const supabase = await createClient();
  const [{ data: kpi }, { data: departments }, { data: predictions }] = await Promise.all([
    supabase.from("v_dashboard_kpis").select("*").maybeSingle(),
    supabase
      .from("v_department_attendance")
      .select("*")
      .order("attendance_pct", { ascending: true }),
    supabase
      .from("performance_predictions")
      .select("id,student_id,predicted_gpa,risk_level,students(full_name)")
      .eq("risk_level", "high")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  const term = await getCurrentTerm();
  return (
    <>
      <SectionHeader
        icon={<LayoutDashboard size={22} />}
        title="Institution overview"
        subtitle={`A live read on operating health${term ? `  ·  ${term.name} term, week ${term.week}` : ""}`}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
        <StatBox label="Active students" value={kpi?.active_students} href="/students" />
        <StatBox label="Active faculty" value={kpi?.active_faculty} href="/faculty" tone="indigo" />
        <StatBox label="Rooms" value={kpi?.rooms} />
        <StatBox label="Attendance" value={formatPercent(kpi?.attendance_pct)} tone="green" />
        <StatBox
          label="Open grievances"
          value={kpi?.open_grievances}
          href="/grievances"
          tone="amber"
        />
        <StatBox label="Upcoming events" value={kpi?.upcoming_events} href="/events" />
        <StatBox
          label="Unassigned slots"
          value={kpi?.unassigned_slots}
          href="/allocation"
          tone="rose"
        />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Attendance by department">
          <AttendanceChart
            data={(departments ?? []).map((r) => ({
              name: String(r.name ?? r.department),
              value: Number(r.attendance_pct ?? 0),
            }))}
          />
        </Card>
        <Card title="High-risk students">
          <div>
            <DataTable
              rows={rowsFrom(predictions)}
              rowHref={(r) => `/students/${String(r.student_id)}`}
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
        </Card>
      </div>
    </>
  );
}
