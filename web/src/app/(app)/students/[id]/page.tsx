import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, DataTable, PageHeader } from "@/components/ui";
import { formatDate, formatPercent, formatStatus } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { rowsFrom, type Row } from "@/types/db";

function riskTone(value: unknown) {
  return value === "high" ? "bad" : value === "medium" ? "warn" : "good";
}

function explainFactors(value: unknown) {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).map(
    ([key, factor]) => `${key.replace(/_/g, " ")}: ${String(factor)}`,
  );
}

export default async function StudentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [student, enrollments, prediction, recommendations, studentRelations, attendance, marks] =
    await Promise.all([
      supabase.from("v_student_directory").select("*").eq("id", id).single(),
      supabase
        .from("enrollments")
        .select(
          "id,grade,grade_point,section_id,course_sections(id,section,academic_terms(name,is_current),courses(code,title,credits))",
        )
        .eq("student_id", id),
      supabase
        .from("performance_predictions")
        .select("predicted_gpa,risk_level,factors,created_at")
        .eq("student_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("recommendations")
        .select("id,kind,score,payload")
        .eq("student_id", id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("students")
        .select("mentor_id,faculty(id,full_name,employee_no)")
        .eq("id", id)
        .single(),
      supabase.from("v_student_attendance").select("section_id,percentage").eq("student_id", id),
      supabase
        .from("marks")
        .select("obtained,exams(section_id,max_marks,weightage)")
        .eq("student_id", id),
    ]);
  if (!student.data) notFound();
  const s = student.data as Row;
  const mentor = Array.isArray(studentRelations.data?.faculty)
    ? studentRelations.data.faculty[0]
    : studentRelations.data?.faculty;
  const attendanceBySection = new Map(
    rowsFrom(attendance.data).map((r) => [String(r.section_id), Number(r.percentage)]),
  );
  // Weighted score so far, as a percentage of the assessments already held.
  const scoreBySection = new Map<string, { earned: number; weight: number }>();
  for (const mark of rowsFrom(marks.data)) {
    const exam = mark.exams as { section_id: string; max_marks: number; weightage: number } | null;
    if (!exam) continue;
    const entry = scoreBySection.get(exam.section_id) ?? { earned: 0, weight: 0 };
    entry.earned += (Number(mark.obtained) / Number(exam.max_marks)) * Number(exam.weightage);
    entry.weight += Number(exam.weightage);
    scoreBySection.set(exam.section_id, entry);
  }
  const courseRows = rowsFrom(enrollments.data)
    .map((r) => {
      const section = r.course_sections as {
        academic_terms?: { name: string; is_current: boolean };
      } | null;
      const score = scoreBySection.get(String(r.section_id));
      return {
        ...r,
        id: r.section_id,
        term: section?.academic_terms?.name ?? "—",
        is_current: section?.academic_terms?.is_current ?? false,
        attendance_pct: attendanceBySection.get(String(r.section_id)) ?? null,
        score_pct: score && score.weight ? (score.earned / score.weight) * 100 : null,
      };
    })
    .sort((a, b) => Number(b.is_current) - Number(a.is_current) || a.term.localeCompare(b.term));
  const courseName = (row: Row) => {
    const section = row.course_sections as {
      id?: string;
      courses?: { code?: string; title?: string };
    } | null;
    return `${section?.courses?.code ?? "—"} · ${section?.courses?.title ?? "Untitled"}`;
  };
  return (
    <>
      <PageHeader
        title={String(s.full_name)}
        description={`${String(s.roll_no)} · ${String(s.program_code)} · ${String(s.department)}`}
      />
      {mentor ? (
        <p className="mb-4 text-sm text-[var(--muted)]">
          Mentor:{" "}
          <Link className="text-indigo-600 hover:underline" href={`/faculty/${String(mentor.id)}`}>
            {String(mentor.full_name)}
          </Link>
        </p>
      ) : null}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Roll no.", s.roll_no],
          ["Programme", s.program_code],
          ["Semester", s.current_semester],
          ["CGPA", s.cgpa ?? "—"],
          ["Attendance", formatPercent(s.attendance_pct as number)],
        ].map(([label, value]) => (
          <div key={String(label)} className="border border-[var(--line)] bg-[var(--panel)] p-4">
            <div className="text-xs text-[var(--muted)]">{String(label)}</div>
            <div className="mt-2 font-semibold tabular">{String(value)}</div>
          </div>
        ))}
      </div>
      <section className="border border-[var(--line)] bg-[var(--panel)] p-5">
        <h2 className="font-medium">Course attendance and marks</h2>
        <div className="mt-4">
          <DataTable
            rows={courseRows}
            rowHref={(r) => `/courses/${String(r.id)}`}
            columns={[
              { key: "course_sections", label: "Course", render: courseName },
              { key: "term", label: "Term" },
              {
                key: "attendance_pct",
                label: "Attendance",
                render: (r) => (
                  <span className={Number(r.attendance_pct) < 75 ? "text-rose-600" : ""}>
                    {formatPercent(r.attendance_pct as number)}
                  </span>
                ),
              },
              {
                key: "score_pct",
                label: "Score so far",
                render: (r) => formatPercent(r.score_pct as number | null),
              },
              { key: "grade", label: "Grade" },
              { key: "grade_point", label: "Grade point" },
            ]}
            empty="No course records are available."
          />
        </div>
      </section>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="border border-[var(--line)] bg-[var(--panel)] p-5">
          <h2 className="font-medium">Latest prediction</h2>
          {prediction.data ? (
            <>
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <div className="text-3xl font-semibold tabular">
                    {String(prediction.data.predicted_gpa)}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    predicted GPA · {formatDate(String(prediction.data.created_at))}
                  </div>
                </div>
                <Badge tone={riskTone(prediction.data.risk_level)}>
                  {String(prediction.data.risk_level)}
                </Badge>
              </div>
              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
                {explainFactors(prediction.data.factors).map((factor) => (
                  <li key={factor}>{factor}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-4 text-sm text-[var(--muted)]">
              No prediction has been generated for this student.
            </p>
          )}
        </section>
        <section className="border border-[var(--line)] bg-[var(--panel)] p-5">
          <h2 className="font-medium">Recommendations</h2>
          <DataTable
            rows={rowsFrom(recommendations.data)}
            columns={[
              { key: "kind", label: "Type", render: (r) => formatStatus(r.kind) },
              {
                key: "payload",
                label: "Recommendation",
                render: (r) => {
                  const p = (r.payload ?? {}) as Record<string, unknown>;
                  const head = p.code
                    ? `${String(p.code)} · ${String(p.title)}`
                    : String(p.skill ?? "—");
                  return (
                    <div>
                      <div>{head}</div>
                      {p.reason ? (
                        <div className="text-xs text-[var(--muted)]">{String(p.reason)}</div>
                      ) : null}
                    </div>
                  );
                },
              },
              {
                key: "score",
                label: "Score",
                render: (r) => (r.score === null ? "—" : Number(r.score).toFixed(2)),
              },
            ]}
            empty="No recommendations are available."
          />
        </section>
      </div>
    </>
  );
}
