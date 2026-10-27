import Link from "next/link";
import { Badge, PageHeader } from "@/components/ui";
import { formatTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Row } from "@/types/db";
import { requireStaff } from "@/lib/data";

const periods = ["09:00", "10:00", "11:15", "12:15", "14:00", "15:00", "16:00"];
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function TimetablePage({
  searchParams,
}: {
  searchParams: Promise<{
    room?: string;
    department?: string;
    semester?: string;
    section?: string;
  }>;
}) {
  await requireStaff();
  const params = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("v_timetable")
    .select(
      "id,weekday,starts_at,ends_at,room_id,room,section_id,course_code,course_title,section,department,semester,faculty,enrolled,is_current",
    )
    .eq("is_current", true)
    .order("weekday")
    .order("starts_at");
  if (params.room) query = query.eq("room", params.room);
  if (params.department) query = query.eq("department", params.department);
  if (params.semester) query = query.eq("semester", Number(params.semester));
  if (params.section) query = query.eq("section", params.section);
  const { data } = await query;
  const rows = (data ?? []) as Row[];
  return (
    <>
      <PageHeader
        title="Timetable"
        description="Current-term teaching schedule, Monday through Saturday."
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <input
          name="room"
          defaultValue={params.room}
          placeholder="Room"
          className="border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm"
        />
        <input
          name="department"
          defaultValue={params.department}
          placeholder="Department"
          className="border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm"
        />
        <input
          name="semester"
          defaultValue={params.semester}
          type="number"
          min="1"
          placeholder="Semester"
          className="w-28 border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm"
        />
        <input
          name="section"
          defaultValue={params.section}
          placeholder="Section"
          className="w-28 border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm"
        />
        <button className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white">
          Filter
        </button>
      </form>
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
                            <div className="text-[var(--muted)]">{String(entry.section ?? "")}</div>
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
