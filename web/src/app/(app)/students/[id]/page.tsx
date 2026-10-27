import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, DataTable, PageHeader } from "@/components/ui";
import { formatDate, formatPercent } from "@/lib/format";
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
  const [student, enrollments, prediction, recommendations, studentRelations] = await Promise.all([
    supabase.from("v_student_directory").select("*").eq("id", id).single(),
    supabase
      .from("enrollments")
      .select(
        "id,marks,grade,grade_point,attendance_pct,course_sections(id,section,courses(code,title))",
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
  ]);
  if (!student.data) notFound();
  const s = student.data as Row;
  const mentor = Array.isArray(studentRelations.data?.faculty)
    ? studentRelations.data.faculty[0]
    : studentRelations.data?.faculty;
  const courseName = (row: Row) => {
    const section = row.course_sections as {
      id?: string;
      courses?: { code?: string; title?: string };
    } | null;
    return section?.id ? (
      <Link className="text-indigo-600 hover:underline" href={`/courses/${section.id}`}>
        {section.courses?.code ?? "—"} · {section.courses?.title ?? "Untitled"}
      </Link>
    ) : (
      `${section?.courses?.code ?? "—"} · ${section?.courses?.title ?? "Untitled"}`
    );
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
            rows={rowsFrom(enrollments.data)}
            columns={[
              { key: "course_sections", label: "Course", render: courseName },
              {
                key: "attendance_pct",
                label: "Attendance",
                render: (r) => (
                  <span className={Number(r.attendance_pct) < 75 ? "text-rose-600" : ""}>
                    {formatPercent(r.attendance_pct as number)}
                  </span>
                ),
              },
              { key: "marks", label: "Marks" },
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
              { key: "kind", label: "Type" },
              { key: "score", label: "Score" },
              {
                key: "payload",
                label: "Recommendation",
                render: (r) =>
                  typeof r.payload === "string" ? r.payload : String(JSON.stringify(r.payload)),
              },
            ]}
            empty="No recommendations are available."
          />
        </section>
      </div>
    </>
  );
}
