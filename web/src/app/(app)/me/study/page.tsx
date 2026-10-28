import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { Chat } from "@/components/chat";
import { SectionHeader } from "@/components/section";
import { getStudentContext } from "@/components/student/context";

// Study Assistant: a tutor scoped to one of the student's registered courses this term.
export default async function StudyPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  const sp = await searchParams;
  const { id, supabase, subtitle } = await getStudentContext();
  const { data } = await supabase
    .from("enrollments")
    .select("section_id,course_sections!inner(academic_terms!inner(is_current),courses(code,title))")
    .eq("student_id", id)
    .eq("course_sections.academic_terms.is_current", true);
  const courses = (data ?? [])
    .map((e) => {
      const c = (e.course_sections as unknown as { courses: { code: string; title: string } }).courses;
      return { section: String(e.section_id), code: c.code, title: c.title };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
  const current = courses.find((c) => c.section === sp.course) ?? courses[0];

  return (
    <>
      <SectionHeader icon={<GraduationCap size={22} />} title="Study Assistant" subtitle={subtitle} />
      {courses.length === 0 ? (
        <p className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 text-sm text-[var(--muted)]">
          You have no registered courses this semester.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <nav className="space-y-1 self-start rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2">
            <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">My courses</p>
            {courses.map((c) => (
              <Link
                key={c.section}
                href={`/me/study?course=${c.section}`}
                className={`block rounded-md px-2 py-2 text-sm ${
                  c.section === current.section ? "bg-indigo-50 font-medium text-indigo-700" : "hover:bg-slate-50"
                }`}
              >
                <span className="block text-xs text-[var(--muted)]">{c.code}</span>
                {c.title}
              </Link>
            ))}
          </nav>
          <Chat
            key={current.section}
            mode="study"
            sectionId={current.section}
            storageKey={`edubase-study-${id}-${current.section}`}
            greeting={`Let's study ${current.code} ${current.title}. Ask me to explain a topic, quiz you, or plan your revision.`}
            suggestions={[
              `Explain the key topics of ${current.title} simply`,
              "Quiz me with 5 questions",
              "Make a revision plan for my next internal test",
              "Which topics should I focus on given my marks?",
            ]}
          />
        </div>
      )}
    </>
  );
}
