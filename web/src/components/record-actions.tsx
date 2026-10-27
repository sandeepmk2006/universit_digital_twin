"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Pencil, Trash2, Plus, Check } from "lucide-react";
import { deleteRecord, checkOutVisitor, returnBook } from "@/app/(app)/actions";

const btn =
  "inline-flex items-center gap-1.5 rounded border border-[var(--line)] px-3 py-1.5 text-sm hover:bg-[#f4f4f5]";
const primary =
  "inline-flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700";

export function AddButton({ module, label }: { module: string; label: string }) {
  return (
    <Link href={`/${module}/new`} className={primary}>
      <Plus size={15} /> Add {label}
    </Link>
  );
}

export function EditDelete({ module, id, label }: { module: string; id: string; label: string }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <Link href={`/${module}/${id}?edit=1`} className={btn}>
        <Pencil size={14} /> Edit
      </Link>
      {confirming ? (
        <>
          <span className="text-sm text-[var(--muted)]">Delete this {label}?</span>
          <button
            disabled={pending}
            onClick={() => start(() => void deleteRecord(module, id))}
            className="rounded bg-rose-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "Deleting…" : "Yes, delete"}
          </button>
          <button onClick={() => setConfirming(false)} className={btn}>
            Cancel
          </button>
        </>
      ) : (
        <button onClick={() => setConfirming(true)} className={`${btn} text-rose-600`}>
          <Trash2 size={14} /> Delete
        </button>
      )}
    </div>
  );
}

export function CheckOutVisitor({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => start(() => checkOutVisitor(id))} className={primary}>
      <Check size={15} /> {pending ? "Checking out…" : "Check out"}
    </button>
  );
}

export function ReturnBook({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => start(() => returnBook(id))} className={primary}>
      <Check size={15} /> {pending ? "Saving…" : "Mark returned"}
    </button>
  );
}
