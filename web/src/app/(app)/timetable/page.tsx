import Link from "next/link";
import { Badge, PageHeader } from "@/components/ui";
import { formatTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Row } from "@/types/db";
import { getMyFacultyId, requireModule } from "@/lib/data";
import { applyCohort, CohortBar, resolveCohort } from "@/components/cohort";

const periods = ["09:00", "10:00", "11:15", "12:15", "14:00", "15:00", "16:00"];
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function TimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; dept?: string; section?: string }>;
}) {
  const profile = await requireModule("timetable");
  const params = await searchParams;
  const supabase = await createClient();
  const isFaculty = profile?.role === "faculty";

  // A timetable belongs to one class (year, department, section) or, for faculty, to the
  // teacher. Showing every class in one grid hid all but one class per period.
  let query = supabase
    .from("v_timetable")
    .select(
      "id,weekday,starts_at,ends_at,room_id,room,section_id,course_code,course_title,section,department,semester,faculty,enrolled,is_current",
    )
    .eq("is_current", true)
    .order("weekday")
    .order("starts_at");
  const cohort = isFaculty ? null : await resolveCohort(params.year, params.dept);
  if (isFaculty) {
    const facultyId = await getMyFacultyId();
    const { data: mine } = await supabase
      .from("course_sections")
      .select("id")
      .eq("faculty_id", facultyId ?? "");
    query = query.in("section_id", (mine ?? []).map((r) => String(r.id)));
  } else if (cohort) {
    query = applyCohort(query, cohort, { sem: "semester", dept: "department" });
  }
  const { data } = await query;
  const all = (data ?? []) as Row[];
  const sections = [...new Set(all.map((r) => String(r.section ?? "")))].sort();
  const section = isFaculty
    ? null
    : sections.includes(params.section ?? "")
      ? params.section!
      : sections[0];
  const rows = section === null ? all : all.filter((r) => String(r.section) === section);
  const sectionHref = (sec: string) =>
    `/timetable?year=${cohort?.year}&dept=${cohort?.dept}&section=${encodeURIComponent(sec)}`;
  return (
    <>
      <PageHeader
        title={isFaculty ? "My timetable" : "Class timetable"}
        description={
          isFaculty
            ? "Your teaching schedule this term, Monday through Saturday."
            : `Current-term timetable of one class: ${cohort?.dept ?? ""} year ${cohort?.year ?? ""}${section ? `, section ${section}` : ""}.`
        }
      />
      {cohort && <CohortBar cohort={cohort} basePath="/timetable" />}
      {cohort && sections.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="w-24 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            Section
          </span>
          {sections.map((sec) => (
            <Link
              key={sec}
              href={sectionHref(sec)}
              className={
                sec === section
                  ? "rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white"
                  : "rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 py-1 text-xs hover:text-indigo-600"
              }
            >
              {sec}
            </Link>
          ))}
        </div>
      )}
      <div className="overflow-x-auto border border-[var(--line)] bg-[var(--panel)]">
        <table className="w-full min-w-[900px] table-fixed text-left text-xs">
          <thead className="border-b border-[var(--line)] bg-[#fafafa]">
            <tr>
              <th className="w-20 px-3 py-3 font-medium text-[var(--muted)]">Time</th>
              {days.map((day) => (
                <th key={day} className="px-3 py-3 font-medium">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {periods.map((period) => (
              <tr key={period}>
                <th className="px-3 py-4 font-medium tabular text-[var(--muted)]">{period}</th>
                {days.map((_, dayIndex) => {
                  const entry = rows.find(
                    (r) =>
                      Number(r.weekday) === dayIndex + 1 &&
                      formatTime(String(r.starts_at)) === period,
                  );
                  return (
                    <td key={dayIndex} className="border-l border-[var(--line)] p-2 align-top">
                      {entry ? (
                        <Link
                          href={`/timetable/${String(entry.id)}`}
                          className="block cursor-pointer"
                        >
                          <div
                            className={
                              entry.room
                                ? "border-l-2 border-indigo-500 pl-2"
                                : "border-l-2 border-amber-500 bg-amber-50 pl-2"
                            }
                          >
                            <div className="font-medium">
                              {String(entry.course_code ?? "Unassigned")}
                            </div>
                            <div className="text-[var(--muted)]">
                              {isFaculty
                                ? `${String(entry.department ?? "")} · Sem ${String(entry.semester ?? "")} · ${String(entry.section ?? "")}`
                                : String(entry.faculty ?? "")}
                            </div>
                            <div className="mt-1">
                              {entry.room ? (
                                String(entry.room)
                              ) : (
                                <Badge tone="warn">Unassigned room</Badge>
                              )}
                            </div>
                          </div>
                        </Link>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
