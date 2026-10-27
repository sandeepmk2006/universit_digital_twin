"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Field } from "@/lib/permissions";
import { createRecord, updateRecord } from "@/app/(app)/actions";

export function RecordForm({
  module,
  label,
  fields,
  mode,
  id,
  defaults,
  backHref,
}: {
  module: string;
  label: string;
  fields: Field[];
  mode: "create" | "edit";
  id?: string;
  defaults?: Record<string, unknown>;
  backHref: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function value(f: Field) {
    const v = defaults?.[f.name];
    if (v === null || v === undefined) return "";
    if (f.type === "tags" && Array.isArray(v)) return v.join(", ");
    if (f.type === "datetime" && typeof v === "string") return v.slice(0, 16);
    if (f.type === "date" && typeof v === "string") return v.slice(0, 10);
    return String(v);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res =
      mode === "create" ? await createRecord(module, form) : await updateRecord(module, id!, form);
    if (res?.error) {
      setError(res.error);
      setBusy(false);
    }
    // On success the action redirects, so nothing more to do here.
  }

  const input =
    "focus-ring mt-1 w-full border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm outline-none";

  return (
    <form onSubmit={onSubmit} className="max-w-xl">
      <h1 className="text-xl font-semibold capitalize">
        {mode === "create" ? `Add ${label}` : `Edit ${label}`}
      </h1>
      <div className="mt-6 space-y-4 border border-[var(--line)] bg-[var(--panel)] p-5">
        {fields.map((f) => (
          <label key={f.name} className="block text-sm font-medium">
            {f.label}
            {f.required && <span className="text-rose-600"> *</span>}
            {f.type === "textarea" ? (
              <textarea name={f.name} defaultValue={value(f)} rows={3} className={input} />
            ) : f.type === "select" ? (
              <select name={f.name} defaultValue={value(f)} required={f.required} className={input}>
                <option value="">Select…</option>
                {f.options?.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name={f.name}
                defaultValue={value(f)}
                required={f.required}
                type={
                  f.type === "number"
                    ? "number"
                    : f.type === "date"
                      ? "date"
                      : f.type === "datetime"
                        ? "datetime-local"
                        : "text"
                }
                className={input}
              />
            )}
            {f.help && <span className="mt-1 block text-xs text-[var(--muted)]">{f.help}</span>}
          </label>
        ))}
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
      <div className="mt-4 flex gap-2">
        <button
          disabled={busy}
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : mode === "create" ? "Create" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => router.push(backHref)}
          className="rounded border border-[var(--line)] px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
