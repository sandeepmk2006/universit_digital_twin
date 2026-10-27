"use client";
import { useState } from "react";
import { PageHeader } from "@/components/ui";
export default function AllocationPage() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function run() {
    setBusy(true);
    setMessage("");
    const r = await fetch("/api/ml/allocate", { method: "POST" });
    const body = await r.json();
    setMessage(body.error ?? (body.message || "Allocation run completed."));
    setBusy(false);
  }
  return (
    <>
      <PageHeader
        title="Room allocation"
        description="Ask the optimizer for a conflict-aware allocation for the current term."
      />
      <div className="max-w-xl border border-[var(--line)] bg-[var(--panel)] p-6">
        <p className="text-sm text-[var(--muted)]">
          The proposed run will be returned by the ML service. Nothing is applied automatically.
        </p>
        <button
          onClick={run}
          disabled={busy}
          className="mt-5 rounded bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {busy ? "Running optimizer…" : "Run allocation"}
        </button>
        {message && <p className="mt-4 border-l-2 border-indigo-600 pl-3 text-sm">{message}</p>}
      </div>
    </>
  );
}
