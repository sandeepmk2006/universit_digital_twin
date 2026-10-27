import { BookOpen } from "lucide-react";
import { DataTable } from "@/components/ui";
import { Card, SectionHeader, StatBox, StatRow } from "@/components/section";
import { getStudentContext } from "@/components/student/context";
import { formatPercent } from "@/lib/format";
import { rowsFrom, type Row } from "@/types/db";

const TABS = [
  { key: "timetable", label: "Class Time Table" },
  { key: "attendance", label: "Class Attendance" },
  { key: "course", label: "Course-wise Attendance" },
];
const PERIODS = ["09:00", "10:00", "11:15", "12:15", "14:00", "15:00", "16:00"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const mark: Record<string, { t: string; c: string }> = {
  present: { t: "P", c: "text-emerald-700" },
  late: { t: "L", c: "text-amber-600" },
  absent: { t: "A", c: "font-semibold text-rose-600" },
  excused: { t: "OD", c: "text-indigo-600" },
};

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const tab = (await searchParams).tab ?? "timetable";
  const { id, supabase, subtitle } = await getStudentContext();

  const { data: enr } = await supabase
    .from("enrollments")
    .select(
      "section_id,course_sections!inner(academic_terms!inner(is_current),courses(code,title))",
    )
    .eq("student_id", id)
    .eq("course_sections.academic_terms.is_current", true);
  const sections = rowsFrom(enr);
  const sectionIds = sections.map((r) => String(r.section_id));

  let body: React.ReactNode = null;

  if (tab === "timetable") {
    const { data } = await supabase
      .from("v_timetable")
      .select("weekday,starts_at,course_code,course_title,room,section")
      .in("section_id", sectionIds);
    const slots = rowsFrom(data);
    body = (
      <Card title="Class Time Table">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-[var(--muted)]">
                <th className="px-3 py-3">Day</th>
                {PERIODS.map((p, i) => (
                  <th key={p} className="px-3 py-3">
                    Hour {i + 1}
                    <div className="font-normal normal-case">{p}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((d, di) => (
                <tr key={d} className="border-t border-[var(--line)] align-top">
                  <td className="px-3 py-3 font-medium">{d}</td>
                  {PERIODS.map((p) => {
                    const s = slots.find(
                      (x) => Number(x.weekday) === di + 1 && String(x.starts_at).startsWith(p),
                    );
                    return (
                      <td key={p} className="px-3 py-3">
                        {s ? (
                          <div>
                            <div className="font-medium text-[var(--brand)]">
                              {String(s.course_code)}
                            </div>
                            <div className="text-xs">{String(s.course_title)}</div>
                            <div className="text-xs text-[var(--muted)]">
                              {String(s.room ?? "Room TBA")}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[var(--muted)]">–</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    );
  }

  if (tab === "attendance") {
    const { data } = await supabase
      .from("attendance_records")
      .select("status,attendance_sessions!inner(held_on,starts_at,section_id)")
      .eq("student_id", id)
      .in("attendance_sessions.section_id", sectionIds);
    const recs = rowsFrom(data);
    const byDate = new Map<string, Record<string, string>>();
    for (const r of recs) {
      const s = r.attendance_sessions as { held_on: string; starts_at: string };
      const row = byDate.get(s.held_on) ?? {};
      row[String(s.starts_at).slice(0, 5)] = String(r.status);
      byDate.set(s.held_on, row);
    }
    const total = recs.length;
    const present = recs.filter((r) => r.status === "present" || r.status === "late").length;
    const od = recs.filter((r) => r.status === "excused").length;
    const dates = [...byDate.keys()].sort().reverse();
    body = (
      <div className="space-y-4">
        <StatRow>
          <StatBox label="Total Hours" value={`${total} hrs`} />
          <StatBox label="Present Hours" value={`${present} hrs`} tone="green" />
          <StatBox
            label="Actual"
            value={formatPercent(total ? (present / total) * 100 : 0)}
            tone="green"
          />
          <StatBox
            label="OD Corrected"
            value={formatPercent(total ? ((present + od) / total) * 100 : 0)}
          />
        </StatRow>
        <Card title="Class Attendance">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-[var(--muted)]">
                  <th className="px-3 py-3">Date</th>
                  {PERIODS.map((p, i) => (
                    <th key={p} className="px-3 py-3">
                      Hour {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dates.map((d) => (
                  <tr key={d} className="border-t border-[var(--line)]">
                    <td className="px-3 py-2.5">{new Date(d).toLocaleDateString("en-GB")}</td>
                    {PERIODS.map((p) => {
                      const st = byDate.get(d)?.[p];
                      const m = st ? mark[st] : null;
                      return (
                        <td key={p} className={`px-3 py-2.5 ${m?.c ?? "text-[var(--muted)]"}`}>
                          {m?.t ?? "-"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">
            P present · L late · A absent · OD on duty / excused
          </p>
        </Card>
      </div>
    );
  }

  if (tab === "course") {
    const { data } = await supabase
      .from("v_student_attendance")
      .select("section_id,sessions,attended,percentage")
      .eq("student_id", id)
      .in("section_id", sectionIds);
    const rows: Row[] = rowsFrom(data).map((a) => {
      const sec = sections.find((x) => String(x.section_id) === String(a.section_id));
      const c = (sec?.course_sections as { courses: { code: string; title: string } } | undefined)
        ?.courses;
      return {
        id: a.section_id,
        code: c?.code,
        title: c?.title,
        total: a.sessions,
        present: a.attended,
        absent: Number(a.sessions) - Number(a.attended),
        pct: a.percentage,
      };
    });
    body = (
      <Card title="Course-wise Attendance">
        <DataTable
          rows={rows}
          rowHref={(r) => `/courses/${String(r.id)}`}
          columns={[
            { key: "code", label: "Subject Code" },
            { key: "title", label: "Subject Name" },
            { key: "total", label: "Total Hours" },
            { key: "present", label: "Present Hours" },
            { key: "absent", label: "Absent Hours" },
            {
              key: "pct",
              label: "Attendance %",
              render: (r) => (
                <span
                  className={Number(r.pct) < 75 ? "font-medium text-rose-600" : "text-emerald-700"}
                >
                  {formatPercent(r.pct as number)}
                </span>
              ),
            },
          ]}
          empty="No attendance recorded this term."
        />
      </Card>
    );
  }

  return (
    <>
      <SectionHeader
        icon={<BookOpen size={22} />}
        title="Classes"
        subtitle={subtitle}
        tabs={TABS}
        activeTab={tab}
        baseHref="/me/classes"
      />
      {body}
    </>
  );
}
