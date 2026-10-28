"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Semester } from "./context";

// EduServe-style "Select the Academic Term" dropdown; only semesters the student reached.
export function SemesterSelect({ semesters, value }: { semesters: Semester[]; value?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">
        Select the Academic Term <span className="text-rose-600">*</span>
      </span>
      <select
        className="min-w-72 rounded border border-[var(--line)] bg-[var(--panel)] px-3 py-2"
        value={value}
        onChange={(e) => {
          const sp = new URLSearchParams(params.toString());
          sp.set("sem", e.target.value);
          router.push(`${pathname}?${sp.toString()}`);
        }}
      >
        {semesters.map((s) => (
          <option key={s.sem} value={s.sem}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}
