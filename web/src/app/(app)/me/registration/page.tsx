import { ListChecks } from "lucide-react";
import { DataTable } from "@/components/ui";
import { Card, SectionHeader, StatBox, StatRow } from "@/components/section";
import { getStudentContext } from "@/components/student/context";
import { formatStatus } from "@/lib/format";
import { rowsFrom } from "@/types/db";

const TABS = [
  { key: "registered", label: "Subject Registration" },
  { key: "electives", label: "Elective Suggestions" },
  { key: "skills", label: "Placement Preparation" },
];

export default async function RegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const tab = (await searchParams).tab ?? "registered";
  const { id, supabase, subtitle } = await getStudentContext();
  const [{ data: enr }, { data: recs }] = await Promise.all([
    supabase
      .from("enrollments")
      .select(
        "section_id,course_sections!inner(section,faculty(full_name),academic_terms!inner(is_current),courses(code,title,credits,is_elective))",
      )
      .eq("student_id", id)
      .eq("course_sections.academic_terms.is_current", true),
    supabase
      .from("recommendations")
      .select("kind,payload,score")
      .eq("student_id", id)
      .order("score", { ascending: false }),
  ]);
  const rows = rowsFrom(enr).map((e) => {
    const cs = e.course_sections as {
      section: string;
      faculty: { full_name: string } | null;
      courses: { code: string; title: string; credits: number; is_elective: boolean };
    };
    return { id: e.section_id, ...cs.courses, section: cs.section, faculty: cs.faculty?.full_name };
  });
  const credits = rows.reduce((n, r) => n + Number(r.credits), 0);
  const kind = tab === "electives" ? "elective" : "placement_prep";
  return (
    <>
      <SectionHeader
        icon={<ListChecks size={22} />}
        title="Registration"
        subtitle={subtitle}
        tabs={TABS}
        activeTab={tab}
        baseHref="/me/registration"
      />
      {tab === "registered" ? (
        <div className="space-y-4">
          <StatRow>
            <StatBox label="Subjects registered" value={rows.length} />
            <StatBox label="Credits" value={credits} tone="green" />
            <StatBox label="Electives" value={rows.filter((r) => r.is_elective).length} />
          </StatRow>
          <Card title="Subject Registration">
            <DataTable
              rows={rows}
              rowHref={(r) => `/courses/${String(r.id)}`}
              columns={[
                { key: "code", label: "Subject Code" },
                { key: "title", label: "Subject Name" },
                {
                  key: "is_elective",
                  label: "Type",
                  render: (r) => (r.is_elective ? "Elective" : "Core"),
                },
                { key: "credits", label: "Credit" },
                { key: "faculty", label: "Faculty" },
                { key: "status", label: "Registration Status", render: () => "Registered" },
              ]}
              empty="No subjects registered for this term."
            />
          </Card>
        </div>
      ) : (
        <Card title={tab === "electives" ? "Elective Suggestions" : "Placement Preparation"}>
          <DataTable
            rows={rowsFrom(recs).filter((r) => r.kind === kind)}
            columns={[
              {
                key: "payload",
                label: tab === "electives" ? "Elective" : "Skill to build",
                render: (r) => {
                  const p = r.payload as Record<string, unknown>;
                  return p.code ? `${String(p.code)} · ${String(p.title)}` : formatStatus(p.skill);
                },
              },
              {
                key: "reason",
                label: "Why",
                render: (r) => String((r.payload as Record<string, unknown>).reason ?? ""),
              },
              {
                key: "score",
                label: "Match",
                render: (r) => `${Math.round(Number(r.score) * 100)}%`,
              },
            ]}
            empty={
              tab === "electives"
                ? "No elective suggestions for your semester."
                : "No skill gaps found for upcoming placement drives."
            }
          />
        </Card>
      )}
    </>
  );
}
