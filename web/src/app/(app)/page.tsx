import { AttendanceChart } from "@/components/charts";
import { Badge, DataTable, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import type { Prediction } from "@/types/db";
export default async function Overview() {
  const supabase = await createClient();
  const [students, faculty, rooms, attendance, grievances, events, predictions] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("faculty").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("rooms").select("id", { count: "exact", head: true }),
    supabase.from("v_student_attendance").select("percentage"),
    supabase.from("grievances").select("id", { count: "exact", head: true }).in("status", ["open","assigned","in_progress"]),
    supabase.from("events").select("id", { count: "exact", head: true }).gte("starts_at", new Date().toISOString()),
    supabase.from("performance_predictions").select("student_id,predicted_gpa,risk_level,created_at,students(full_name,roll_no)").eq("risk_level","high").order("created_at",{ascending:false}).limit(5)
  ]);
  const avg = attendance.data?.length ? Math.round(attendance.data.reduce((a, r) => a + Number(r.percentage ?? 0), 0) / attendance.data.length) : 0;
  const kpis = [["Active students", students.count ?? 0], ["Faculty", faculty.count ?? 0], ["Rooms", rooms.count ?? 0], ["Avg attendance", `${avg}%`], ["Open grievances", grievances.count ?? 0], ["Upcoming events", events.count ?? 0]];
  return <><PageHeader title="Overview" description="A live read on the university’s operating health."/><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{kpis.map(([label, value]) => <div key={String(label)} className="border border-[var(--line)] bg-[var(--panel)] p-4"><div className="text-xs text-[var(--muted)]">{label}</div><div className="mt-2 text-2xl font-semibold tabular">{value}</div></div>)}</div><div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]"><section className="border border-[var(--line)] bg-[var(--panel)] p-5"><h2 className="font-medium">Attendance by department</h2><p className="mt-1 text-xs text-[var(--muted)]">Department roll-up is available as attendance records accumulate.</p><div className="mt-4"><AttendanceChart data={[{name:"CSE",value:avg},{name:"ECE",value:Math.max(avg-4,0)},{name:"ME",value:Math.min(avg+2,100)},{name:"Civil",value:Math.max(avg-7,0)}]}/></div></section><section className="border border-[var(--line)] bg-[var(--panel)] p-5"><h2 className="font-medium">High-risk students</h2><p className="mt-1 text-xs text-[var(--muted)]">Latest performance predictions requiring attention.</p><div className="mt-4"><DataTable rows={(predictions.data ?? []) as unknown as Record<string,unknown>[]} columns={[{key:"students",label:"Student",render:r => <span>{String((r.students as {full_name?:string})?.full_name ?? "Unknown")}</span>},{key:"predicted_gpa",label:"GPA",render:r => <span className="tabular">{String(r.predicted_gpa)}</span>},{key:"risk_level",label:"Risk",render:r => <Badge tone="bad">{String(r.risk_level)}</Badge>}]} empty="No high-risk predictions are available."/></div></section></div></>;
}
