import Link from "next/link";
import { notFound } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { Badge, DataTable } from "@/components/ui";
import { Card, SectionHeader, StatBox, StatRow } from "@/components/section";
import { formatDate, formatMoney, formatPercent, formatStatus } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTerm, getProfile } from "@/lib/data";
import { canWrite } from "@/lib/permissions";
import { RecordFormPage } from "@/components/record-form-page";
import { EditDelete } from "@/components/record-actions";
import { rowsFrom, type Row } from "@/types/db";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "attendance", label: "Attendance" },
  { key: "results", label: "Results" },
  { key: "advisory", label: "Advisory" },
  { key: "fees", label: "Fees" },
];

function riskTone(v: unknown) {
  return v === "high" ? "bad" : v === "medium" ? "warn" : "good";
}

export default async function StudentDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; edit?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (id === "new") return <RecordFormPage module="students" />;
  if (sp.edit) return <RecordFormPage module="students" id={id} />;
  const tab = sp.tab ?? "overview";
  const viewer = await getProfile();
  const supabase = await createClient();

  const [
    student,
    enrollments,
    attendance,
    marks,
    prediction,
    recommendations,
    rel,
    invoices,
    term,
  ] = await Promise.all([
    supabase.from("v_student_directory").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("enrollments")
      .select(
        "id,grade,grade_point,section_id,course_sections(academic_terms(name,is_current),courses(code,title,credits))",
      )
      .eq("student_id", id),
    supabase
      .from("v_student_attendance")
      .select("section_id,sessions,attended,percentage")
      .eq("student_id", id),
    supabase
      .from("marks")
      .select("obtained,exams(section_id,max_marks,weightage)")
      .eq("student_id", id),
    supabase
      .from("performance_predictions")
      .select("predicted_gpa,risk_level,factors,created_at")
      .eq("student_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("recommendations").select("id,kind,score,payload").eq("student_id", id).limit(8),
    supabase.from("students").select("faculty(id,full_name)").eq("id", id).maybeSingle(),
    supabase
      .from("invoices")
      .select("id,amount,due_on,status,academic_terms(name)")
      .eq("student_id", id),
    getCurrentTerm(),
  ]);

  if (!student.data) notFound();
  const s = student.data as Row;
  const mentor = Array.isArray(rel.data?.faculty) ? rel.data.faculty[0] : rel.data?.faculty;

  // Per-course attendance and score so far.
  const attBySection = new Map(rowsFrom(attendance.data).map((r) => [String(r.section_id), r]));
  const scoreBySection = new Map<string, { earned: number; weight: number }>();
  for (const m of rowsFrom(marks.data)) {
    const e = m.exams as { section_id: string; max_marks: number; weightage: number } | null;
    if (!e) continue;
    const cur = scoreBySection.get(e.section_id) ?? { earned: 0, weight: 0 };
    cur.earned += (Number(m.obtained) / Number(e.max_marks)) * Number(e.weightage);
    cur.weight += Number(e.weightage);
    scoreBySection.set(e.section_id, cur);
  }
  const courses = rowsFrom(enrollments.data).map((r) => {
    const sec = r.course_sections as {
      academic_terms?: { name: string; is_current: boolean };
      courses?: { code: string; title: string; credits: number };
    } | null;
    const att = attBySection.get(String(r.section_id));
    const sc = scoreBySection.get(String(r.section_id));
    return {
      id: r.section_id,
      code: sec?.courses?.code ?? "—",
      title: sec?.courses?.title ?? "—",
      credits: sec?.courses?.credits ?? 0,
      term: sec?.academic_terms?.name ?? "—",
      is_current: sec?.academic_terms?.is_current ?? false,
      attendance_pct: att ? Number(att.percentage) : null,
      sessions: att ? Number(att.sessions) : 0,
      attended: att ? Number(att.attended) : 0,
      grade: r.grade,
      grade_point: r.grade_point,
      score_pct: sc && sc.weight ? (sc.earned / sc.weight) * 100 : null,
    };
  });
  const current = courses.filter((c) => c.is_current);
  const totalSessions = current.reduce((n, c) => n + c.sessions, 0);
  const totalAttended = current.reduce((n, c) => n + c.attended, 0);

  const inv = rowsFrom(invoices.data);
  const invoiced = inv.reduce((n, r) => n + Number(r.amount), 0);

  const courseLink = (r: Row) => `/courses/${String(r.id)}`;

  return (
    <>
      <SectionHeader
        icon={<GraduationCap size={22} />}
        title={String(s.full_name)}
        subtitle={`${String(s.roll_no)}  ·  ${String(s.program_code)} (${String(s.department)})  ·  Semester ${String(s.current_semester)}${term ? ` (${term.name})` : ""}`}
        action={
          canWrite(viewer?.role, "students") ? (
            <EditDelete module="students" id={id} label="student" />
          ) : undefined
        }
        tabs={TABS}
        activeTab={tab}
        baseHref={`/students/${id}`}
      />

      {tab === "overview" && (
        <div className="space-y-4">
          <StatRow>
            <StatBox label="Register Number" value={String(s.roll_no)} />
            <StatBox label="CGPA" value={s.cgpa ?? "—"} tone="green" />
            <StatBox
              label="Class Attendance"
              value={formatPercent(s.attendance_pct as number)}
              tone="green"
            />
            <StatBox
              label="Performance Risk"
              value={<Badge tone={riskTone(s.risk_level)}>{String(s.risk_level ?? "n/a")}</Badge>}
              tone="amber"
            />
          </StatRow>
          <Card title="Student details">
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Register Number", s.roll_no],
                ["Programme", s.program_code],
                ["Department", s.department],
                ["Current Semester", s.current_semester],
                ["Batch", s.batch_year],
                ["Status", formatStatus(s.status)],
                ["Email", s.email],
                [
                  "Mentor",
                  mentor ? (
                    <Link
                      className="text-indigo-600 hover:underline"
                      href={`/faculty/${String(mentor.id)}`}
                    >
                      {String(mentor.full_name)}
                    </Link>
                  ) : (
                    "—"
                  ),
                ],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dt className="text-xs text-[var(--muted)]">{String(label)}</dt>
                  <dd className="mt-1 text-sm">{value as React.ReactNode}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      )}

      {tab === "attendance" && (
        <div className="space-y-4">
          <StatRow>
            <StatBox label="Total Sessions" value={totalSessions} />
            <StatBox label="Attended" value={totalAttended} tone="green" />
            <StatBox
              label="Attendance"
              value={formatPercent(s.attendance_pct as number)}
              tone={Number(s.attendance_pct) < 75 ? "rose" : "green"}
            />
            <StatBox
              label="Shortfall below 75%"
              value={current.filter((c) => (c.attendance_pct ?? 100) < 75).length}
              tone="amber"
            />
          </StatRow>
          <Card title="Course-wise attendance">
            <DataTable
              rows={current as unknown as Row[]}
              rowHref={courseLink}
              columns={[
                {
                  key: "code",
                  label: "Course",
                  render: (r) => `${String(r.code)} · ${String(r.title)}`,
                },
                { key: "sessions", label: "Sessions" },
                { key: "attended", label: "Attended" },
                {
                  key: "attendance_pct",
                  label: "Attendance",
                  render: (r) => (
                    <span
                      className={Number(r.attendance_pct) < 75 ? "font-medium text-rose-600" : ""}
                    >
                      {formatPercent(r.attendance_pct as number)}
                    </span>
                  ),
                },
              ]}
              empty="No attendance recorded this term."
            />
          </Card>
        </div>
      )}

      {tab === "results" && (
        <div className="space-y-4">
          <StatRow>
            <StatBox label="CGPA" value={s.cgpa ?? "—"} tone="green" />
            <StatBox label="Courses this term" value={current.length} />
            <StatBox label="Credits" value={current.reduce((n, c) => n + Number(c.credits), 0)} />
          </StatRow>
          <Card title="This term — marks so far">
            <DataTable
              rows={current as unknown as Row[]}
              rowHref={courseLink}
              columns={[
                {
                  key: "code",
                  label: "Course",
                  render: (r) => `${String(r.code)} · ${String(r.title)}`,
                },
                { key: "credits", label: "Credits" },
                {
                  key: "score_pct",
                  label: "Score so far",
                  render: (r) => formatPercent(r.score_pct as number),
                },
              ]}
              empty="No marks recorded yet."
            />
          </Card>
          <Card title="Completed courses">
            <DataTable
              rows={courses.filter((c) => !c.is_current && c.grade) as unknown as Row[]}
              rowHref={courseLink}
              columns={[
                { key: "term", label: "Term" },
                {
                  key: "code",
                  label: "Course",
                  render: (r) => `${String(r.code)} · ${String(r.title)}`,
                },
                { key: "credits", label: "Credits" },
                {
                  key: "grade",
                  label: "Grade",
                  render: (r) =>
                    r.grade ? (
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        {String(r.grade)}
                      </span>
                    ) : (
                      "—"
                    ),
                },
              ]}
              empty="No completed courses yet."
            />
          </Card>
        </div>
      )}

      {tab === "advisory" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Predicted performance">
            {prediction.data ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold tabular">
                      {String(prediction.data.predicted_gpa)}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      predicted GPA · {formatDate(String(prediction.data.created_at))}
                    </div>
                  </div>
                  <Badge tone={riskTone(prediction.data.risk_level)}>
                    {String(prediction.data.risk_level)} risk
                  </Badge>
                </div>
                <ul className="mt-4 space-y-1 text-sm text-[var(--muted)]">
                  {Object.entries((prediction.data.factors ?? {}) as Record<string, unknown>).map(
                    ([k, v]) => (
                      <li key={k}>
                        {k.replace(/_/g, " ")}:{" "}
                        <span className="text-[var(--ink)]">{String(v)}</span>
                      </li>
                    ),
                  )}
                </ul>
              </>
            ) : (
              <p className="text-sm text-[var(--muted)]">No prediction generated.</p>
            )}
          </Card>
          <Card title="Recommendations">
            <DataTable
              rows={rowsFrom(recommendations.data)}
              columns={[
                { key: "kind", label: "Type", render: (r) => formatStatus(r.kind) },
                {
                  key: "payload",
                  label: "Suggestion",
                  render: (r) => {
                    const p = (r.payload ?? {}) as Record<string, unknown>;
                    const head = p.code
                      ? `${String(p.code)} · ${String(p.title)}`
                      : String(p.skill ?? "—");
                    return (
                      <div>
                        <div>{head}</div>
                        {Boolean(p.reason) && (
                          <div className="text-xs text-[var(--muted)]">{String(p.reason)}</div>
                        )}
                      </div>
                    );
                  },
                },
              ]}
              empty="No recommendations yet."
            />
          </Card>
        </div>
      )}

      {tab === "fees" && (
        <div className="space-y-4">
          <StatRow>
            <StatBox label="Total Invoiced" value={formatMoney(invoiced)} tone="green" />
            <StatBox label="Invoices" value={inv.length} />
            <StatBox
              label="Unpaid"
              value={inv.filter((r) => r.status !== "paid").length}
              tone="amber"
            />
          </StatRow>
          <Card title="Fee invoices">
            <DataTable
              rows={inv}
              columns={[
                { key: "academic_terms", label: "Term" },
                { key: "amount", label: "Amount", render: (r) => formatMoney(r.amount as number) },
                { key: "due_on", label: "Due", render: (r) => formatDate(String(r.due_on)) },
                {
                  key: "status",
                  label: "Status",
                  render: (r) => (
                    <Badge tone={r.status === "paid" ? "good" : "warn"}>
                      {formatStatus(r.status)}
                    </Badge>
                  ),
                },
              ]}
              empty="No invoices on record."
            />
          </Card>
        </div>
      )}
    </>
  );
}
