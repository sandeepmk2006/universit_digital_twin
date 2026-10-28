"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAttendance } from "@/app/(app)/mark-attendance/actions";

type Status = "present" | "absent" | "late" | "excused";
type Student = { id: string; roll_no: string; full_name: string; status?: Status };

const OPTIONS: { value: Status; label: string; on: string }[] = [
  { value: "present", label: "P", on: "bg-emerald-600 text-white border-emerald-600" },
  { value: "absent", label: "A", on: "bg-rose-600 text-white border-rose-600" },
  { value: "late", label: "L", on: "bg-amber-500 text-white border-amber-500" },
  { value: "excused", label: "OD", on: "bg-indigo-600 text-white border-indigo-600" },
];

export function AttendanceForm({
  sectionId,
  heldOn,
  startsAt,
  students,
  alreadyTaken,
}: {
  sectionId: string;
  heldOn: string;
  startsAt: string;
  students: Student[];
  alreadyTaken: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  const [marks, setMarks] = useState<Record<string, Status>>(() =>
    Object.fromEntries(students.map((s) => [s.id, s.status ?? "present"])),
  );

  const setAll = (status: Status) => setMarks(Object.fromEntries(students.map((s) => [s.id, status])));
  const count = (s: Status) => Object.values(marks).filter((m) => m === s).length;

  function save() {
    setMsg(null);
    start(async () => {
      const res = await saveAttendance(
        sectionId,
        heldOn,
        startsAt,
        students.map((s) => ({ studentId: s.id, status: marks[s.id] })),
      );
      if (res?.error) setMsg({ text: res.error });
      else {
        setMsg({ ok: true, text: `${res.text} Students, mentors, the HOD and the admin see it now.` });
        router.refresh();
      }
    });
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <button type="button" onClick={() => setAll("present")} className="rounded border border-[var(--line)] px-3 py-1.5 hover:border-emerald-400">
          Mark all present
        </button>
        <button type="button" onClick={() => setAll("absent")} className="rounded border border-[var(--line)] px-3 py-1.5 hover:border-rose-400">
          Mark all absent
        </button>
        <span className="ml-auto text-[var(--muted)]">
          {count("present")} present · {count("absent")} absent · {count("late")} late · {count("excused")} on duty
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--line)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Reg. no.</th>
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">Attendance</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => (
              <tr key={s.id} className="border-t border-[var(--line)]">
                <td className="px-3 py-2 text-[var(--muted)]">{i + 1}</td>
                <td className="px-3 py-2 font-medium text-indigo-600">{s.roll_no}</td>
                <td className="px-3 py-2">{s.full_name}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1.5" role="radiogroup" aria-label={`Attendance for ${s.full_name}`}>
                    {OPTIONS.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={marks[s.id] === o.value}
                        onClick={() => setMarks((m) => ({ ...m, [s.id]: o.value }))}
                        className={`h-8 min-w-10 rounded border px-2 text-xs font-semibold ${
                          marks[s.id] === o.value ? o.on : "border-[var(--line)] text-[var(--muted)] hover:bg-slate-50"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded bg-indigo-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : alreadyTaken ? "Update attendance" : "Save attendance"}
        </button>
        {msg && (
          <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-rose-600"}`}>{msg.text}</span>
        )}
      </div>
    </div>
  );
}
