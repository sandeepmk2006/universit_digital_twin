"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";
import { applyLeave, requestService } from "@/app/(app)/me/actions";

const input =
  "focus-ring mt-1 w-full rounded border border-[var(--line)] bg-[#f8fafc] px-3 py-2 text-sm outline-none";
const label = "block text-sm font-medium";
const req = <span className="text-rose-600"> *</span>;

export function LeaveForm({ termName }: { termName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const el = e.currentTarget;
    start(async () => {
      const res = await applyLeave(form);
      if (res?.error) setMsg({ text: res.error });
      else {
        setMsg({ ok: true, text: "Leave applied. Your mentor will review it." });
        el.reset();
        router.push("/me/leave");
      }
    });
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-4">
      <label className={label}>
        Subject{req}
        <input name="subject" required placeholder="Enter your leave subject" className={input} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Academic term{req}
          <input value={`${termName} Semester`} readOnly className={input} />
        </label>
        <label className={label}>
          Leave type{req}
          <select name="leave_type" required className={input} defaultValue="">
            <option value="" disabled>
              Select leave type
            </option>
            <option value="medical">Medical leave</option>
            <option value="on_duty">On duty</option>
            <option value="personal">Personal leave</option>
            <option value="emergency">Emergency leave</option>
          </select>
        </label>
        <label className={label}>
          From date{req}
          <input name="from_date" type="date" required className={input} />
        </label>
        <label className={label}>
          To date{req}
          <input name="to_date" type="date" required className={input} />
        </label>
        <label className={label}>
          From session{req}
          <select name="from_session" className={input} defaultValue="full_day">
            <option value="full_day">Full day</option>
            <option value="forenoon">Forenoon</option>
            <option value="afternoon">Afternoon</option>
          </select>
        </label>
        <label className={label}>
          To session{req}
          <select name="to_session" className={input} defaultValue="full_day">
            <option value="full_day">Full day</option>
            <option value="forenoon">Forenoon</option>
            <option value="afternoon">Afternoon</option>
          </select>
        </label>
      </div>
      <label className={label}>
        Reason
        <textarea name="reason" rows={3} placeholder="Type your reason" className={input} />
      </label>
      {msg && (
        <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-rose-600"}`}>{msg.text}</p>
      )}
      <div className="flex justify-center gap-2">
        <button type="reset" className="rounded border border-[var(--line)] px-4 py-2 text-sm">
          Discard
        </button>
        <button
          disabled={pending}
          className="rounded bg-indigo-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Submitting…" : "Apply leave"}
        </button>
      </div>
    </form>
  );
}

export function BonafideForm({ hostel, room }: { hostel: string; room: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  const [purpose, setPurpose] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await requestService("Bonafide certificate", purpose, 0);
          setMsg(
            res?.error
              ? { text: res.error }
              : {
                  ok: true,
                  text: "Request submitted. You'll be notified when the certificate is ready.",
                },
          );
        });
      }}
      className="mx-auto max-w-3xl space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Hostel name
          <input value={hostel} readOnly className={input} />
        </label>
        <label className={label}>
          Hostel room no.
          <input value={room} readOnly className={input} />
        </label>
      </div>
      <label className={`${label} mx-auto max-w-md`}>
        Purpose of certificate{req}
        <select
          required
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          className={input}
        >
          <option value="" disabled>
            Select purpose
          </option>
          <option>Educational loan</option>
          <option>Passport application</option>
          <option>Scholarship</option>
          <option>Bank account</option>
          <option>Internship</option>
          <option>Visa application</option>
        </select>
      </label>
      {msg && (
        <p className={`text-center text-sm ${msg.ok ? "text-emerald-700" : "text-rose-600"}`}>
          {msg.text}
        </p>
      )}
      <div className="flex justify-center gap-2">
        <button
          type="button"
          onClick={() => setPurpose("")}
          className="rounded border border-[var(--line)] px-4 py-2 text-sm"
        >
          Discard
        </button>
        <button
          disabled={pending}
          className="rounded bg-indigo-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Submitting…" : "Submit"}
        </button>
      </div>
    </form>
  );
}

export function RequestButton({ service, fee }: { service: string; fee: number }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<"idle" | "done" | string>("idle");
  if (state === "done") return <span className="text-sm text-emerald-700">Requested</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await requestService(service, null, fee);
            setState(res?.error ?? "done");
          })
        }
        className="rounded bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
      >
        {pending ? "…" : "Request"}
      </button>
      {state !== "idle" && state !== "done" && (
        <span className="text-xs text-rose-600">{state}</span>
      )}
    </span>
  );
}

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded border border-[var(--line)] px-3 py-1.5 text-sm hover:bg-[#f4f4f5] print:hidden"
    >
      <Printer size={14} /> Print
    </button>
  );
}
