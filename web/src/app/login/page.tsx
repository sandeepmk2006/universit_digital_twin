"use client";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
export default function LoginPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const { error } = await createClient().auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    if (error) setError(error.message);
    else window.location.href = "/";
    setBusy(false);
  }
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--paper)] p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm border border-[var(--line)] bg-[var(--panel)] p-7"
      >
        <div className="mb-8 flex items-center gap-2 font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded bg-indigo-600 text-xs font-bold text-white">
            E
          </span>
          EduBase
        </div>
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">University operations platform</p>
        <label className="mt-7 block text-sm font-medium">
          Email
          <input
            required
            name="email"
            type="email"
            className="focus-ring mt-2 w-full border border-[var(--line)] bg-transparent px-3 py-2 outline-none"
          />
        </label>
        <label className="mt-4 block text-sm font-medium">
          Password
          <input
            required
            name="password"
            type="password"
            className="focus-ring mt-2 w-full border border-[var(--line)] bg-transparent px-3 py-2 outline-none"
          />
        </label>
        {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
        <button
          disabled={busy}
          className="mt-6 w-full rounded bg-indigo-600 px-3 py-2 font-medium text-white disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="mt-5 text-xs leading-5 text-[var(--muted)]">
          Demo accounts: admin@edubase.edu, placements@edubase.edu,
          abhishek.krishnan.23cse001@student.edubase.edu. Password: EduBase@2026
        </p>
      </form>
    </main>
  );
}
