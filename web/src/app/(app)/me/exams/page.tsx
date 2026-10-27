import { GraduationCap, PencilLine } from "lucide-react";
import { Badge, DataTable } from "@/components/ui";
import { Card, SectionHeader, StatBox, StatRow } from "@/components/section";
import { PrintButton } from "@/components/student/forms";
import { getStudentContext } from "@/components/student/context";
import { formatDate, formatStatus } from "@/lib/format";
import { rowsFrom, type Row } from "@/types/db";

const TABS = [
  { key: "schedule", label: "Exam Time Table" },
  { key: "internals", label: "Internal Assessment" },
  { key: "results", label: "Exam Results" },
  { key: "cgpa", label: "Exam History - CGPA/SGPA" },
  { key: "hallticket", label: "Hall Ticket" },
];

type Enr = {
  section_id: string;
  grade: string | null;
  grade_point: number | null;
  course_sections: {
    courses: { code: string; title: string; credits: number };
    academic_terms: { name: string; is_current: boolean; starts_on: string };
  };
};

// End-semester exams run 1–11 Dec 2026 (academic calendar), one paper a day, no Sundays.
function endSemDates(n: number) {
  const out: string[] = [];
  const d = new Date("2026-12-01T00:00:00");
  while (out.length < n) {
    if (d.getDay() !== 0) out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export default async function ExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const tab = (await searchParams).tab ?? "schedule";
  const { id, supabase, student: s, programme, subtitle, term } = await getStudentContext();

  const { data: enrData } = await supabase
    .from("enrollments")
    .select(
      "section_id,grade,grade_point,course_sections(courses(code,title,credits),academic_terms(name,is_current,starts_on))",
    )
    .eq("student_id", id);
  const enr = (enrData ?? []) as unknown as Enr[];
  const current = enr.filter((e) => e.course_sections.academic_terms.is_current);
  const currentIds = current.map((e) => e.section_id);
  const course = (sid: unknown) =>
    current.find((e) => e.section_id === String(sid))?.course_sections.courses;

  let body: React.ReactNode = null;

  if (tab === "schedule") {
    const { data } = await supabase
      .from("exams")
      .select("id,section_id,kind,max_marks,held_on,rooms(code)")
      .in("section_id", currentIds)
      .order("held_on", { ascending: true, nullsFirst: false });
    const dates = endSemDates(current.length);
    const rows: Row[] = rowsFrom(data).map((e) => {
      const c = course(e.section_id);
      const endIdx = current.findIndex((x) => x.section_id === String(e.section_id));
      return {
        ...e,
        code: c?.code,
        title: c?.title,
        date: e.held_on ?? dates[endIdx],
        planned: !e.held_on,
      };
    });
    const ends = current.map((c, i) => ({
      id: `end-${c.section_id}`,
      kind: "end_semester",
      code: c.course_sections.courses.code,
      title: c.course_sections.courses.title,
      date: dates[i],
      session: "FN 09:30–12:30",
      rooms: { code: "Convention Centre" },
      max_marks: 100,
      planned: true,
    }));
    body = (
      <Card title="Examination Time Table">
        <DataTable
          rows={[...rows.filter((r) => !r.planned), ...ends] as Row[]}
          columns={[
            { key: "date", label: "Exam Date", render: (r) => formatDate(String(r.date)) },
            { key: "kind", label: "Exam", render: (r) => formatStatus(r.kind) },
            {
              key: "code",
              label: "Subject",
              render: (r) => `${String(r.code)} · ${String(r.title)}`,
            },
            {
              key: "session",
              label: "Session",
              render: (r) => String(r.session ?? "FN 09:30–11:30"),
            },
            { key: "rooms", label: "Venue" },
            { key: "max_marks", label: "Max marks" },
            {
              key: "planned",
              label: "Status",
              render: (r) =>
                r.planned ? (
                  <Badge tone="warn">upcoming</Badge>
                ) : (
                  <Badge tone="good">completed</Badge>
                ),
            },
          ]}
          empty="No examinations scheduled."
        />
      </Card>
    );
  }

  if (tab === "internals") {
    const { data } = await supabase
      .from("marks")
      .select("obtained,exams!inner(kind,max_marks,held_on,section_id)")
      .eq("student_id", id)
      .in("exams.section_id", currentIds);
    const rows: Row[] = rowsFrom(data)
      .map((m) => {
        const e = m.exams as {
          kind: string;
          max_marks: number;
          held_on: string;
          section_id: string;
        };
        const c = course(e.section_id);
        return {
          code: c?.code,
          title: c?.title,
          kind: e.kind,
          obtained: m.obtained,
          max: e.max_marks,
          held_on: e.held_on,
        };
      })
      .sort(
        (a, b) =>
          String(a.code).localeCompare(String(b.code)) ||
          String(a.held_on).localeCompare(String(b.held_on)),
      );
    body = (
      <Card title="Internal Assessment">
        <DataTable
          rows={rows}
          columns={[
            { key: "code", label: "Subject Code" },
            { key: "title", label: "Subject Name" },
            { key: "kind", label: "IA Parameter", render: (r) => formatStatus(r.kind) },
            {
              key: "obtained",
              label: "Marks Scored",
              render: (r) => Number(r.obtained).toFixed(1),
            },
            { key: "max", label: "Total Marks" },
            { key: "held_on", label: "Test Date", render: (r) => formatDate(String(r.held_on)) },
          ]}
          empty="No internal marks published yet."
        />
      </Card>
    );
  }

  const graded = enr.filter((e) => !e.course_sections.academic_terms.is_current && e.grade);

  if (tab === "results") {
    body = (
      <Card title="Exam Results">
        <DataTable
          rows={graded.map((e) => ({
            term: e.course_sections.academic_terms.name,
            code: e.course_sections.courses.code,
            title: e.course_sections.courses.title,
            credits: e.course_sections.courses.credits,
            grade: e.grade,
          }))}
          columns={[
            { key: "term", label: "Month & Year", render: (r) => `${String(r.term)}` },
            { key: "code", label: "Subject Code" },
            { key: "title", label: "Subject Name" },
            { key: "credits", label: "Credits" },
            {
              key: "result",
              label: "Result",
              render: (r) =>
                r.grade === "F" ? <span className="font-medium text-rose-600">FAIL</span> : "PASS",
            },
            {
              key: "grade",
              label: "Grade",
              render: (r) => (
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${r.grade === "F" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}
                >
                  {String(r.grade)}
                </span>
              ),
            },
          ]}
          empty="No results published yet."
        />
      </Card>
    );
  }

  if (tab === "cgpa") {
    const terms = new Map<
      string,
      { credits: number; points: number; start: string; arrears: number }
    >();
    for (const e of graded) {
      const t = e.course_sections.academic_terms;
      const cur = terms.get(t.name) ?? { credits: 0, points: 0, start: t.starts_on, arrears: 0 };
      const cr = Number(e.course_sections.courses.credits);
      cur.credits += cr;
      cur.points += cr * Number(e.grade_point ?? 0);
      if (e.grade === "F") cur.arrears += 1;
      terms.set(t.name, cur);
    }
    const rows = [...terms.entries()]
      .sort((a, b) => a[1].start.localeCompare(b[1].start))
      .map(([name, t]) => ({
        name,
        credits: t.credits,
        sgpa: t.credits ? t.points / t.credits : 0,
        arrears: t.arrears,
      }));
    const arrears = graded.filter((e) => e.grade === "F").length;
    body = (
      <div className="space-y-4">
        <StatRow>
          <StatBox label="CGPA" value={s.cgpa ?? "—"} tone="green" />
          <StatBox
            label="Credits earned"
            value={graded
              .filter((e) => e.grade !== "F")
              .reduce((n, e) => n + Number(e.course_sections.courses.credits), 0)}
          />
          <StatBox label="No. of Arrears" value={arrears} tone={arrears ? "rose" : "green"} />
        </StatRow>
        <Card title="Exam History - CGPA / SGPA">
          <DataTable
            rows={rows}
            columns={[
              { key: "name", label: "Semester" },
              { key: "credits", label: "Credits registered" },
              { key: "sgpa", label: "SGPA", render: (r) => Number(r.sgpa).toFixed(2) },
              { key: "arrears", label: "Arrears" },
            ]}
            empty="No completed semesters yet."
          />
        </Card>
      </div>
    );
  }

  if (tab === "hallticket") {
    const dates = endSemDates(current.length);
    const seat =
      1 +
      (Math.abs([...String(s.roll_no)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7)) % 60);
    body = (
      <Card title="Hall Ticket" right={<PrintButton />}>
        <div className="mx-auto max-w-4xl rounded border border-[var(--ink)] p-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-lg font-semibold text-[var(--brand)]">
              <GraduationCap size={22} /> EduBase University
            </div>
            <div className="mt-1 font-medium">Examinations Hall Ticket</div>
            <div className="text-sm text-[var(--muted)]">
              {term?.name} Semester (Regular Examinations)
            </div>
          </div>
          <div className="mt-6 grid gap-1 text-sm">
            <div>
              Student Reg No: <span className="font-semibold">{String(s.roll_no)}</span>
            </div>
            <div>
              Student Name: <span className="font-semibold">{String(s.full_name)}</span>
            </div>
            <div>
              Program Name: <span className="font-semibold">{programme}</span>
            </div>
          </div>
          <table className="mt-6 w-full border-collapse text-sm">
            <thead>
              <tr className="border border-[var(--line)] bg-[#f8fafc] text-left">
                {[
                  "Subject Code",
                  "Subject Name",
                  "Date of Exam",
                  "Session",
                  "Block",
                  "Bay No",
                  "Seat No",
                  "Invigilator Signature",
                ].map((h) => (
                  <th key={h} className="border border-[var(--line)] px-2 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {current.map((c, i) => (
                <tr key={c.section_id}>
                  <td className="border border-[var(--line)] px-2 py-2">
                    {c.course_sections.courses.code}
                  </td>
                  <td className="border border-[var(--line)] px-2 py-2">
                    {c.course_sections.courses.title}
                  </td>
                  <td className="border border-[var(--line)] px-2 py-2">{formatDate(dates[i])}</td>
                  <td className="border border-[var(--line)] px-2 py-2">FN</td>
                  <td className="border border-[var(--line)] px-2 py-2">Convention Centre</td>
                  <td className="border border-[var(--line)] px-2 py-2">Bay {1 + (i % 4)}</td>
                  <td className="border border-[var(--line)] px-2 py-2">{seat}</td>
                  <td className="border border-[var(--line)] px-2 py-2" />
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-[var(--muted)]">
            Carry this hall ticket and your college ID card to every examination. Students with less
            than 75% attendance are not eligible to write the end-semester examination.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <SectionHeader
        icon={<PencilLine size={22} />}
        title="Exams"
        subtitle={subtitle}
        tabs={TABS}
        activeTab={tab}
        baseHref="/me/exams"
      />
      {body}
    </>
  );
}
