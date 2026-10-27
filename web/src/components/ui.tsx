import Link from "next/link";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const colors = {
    neutral: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    good: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    warn: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    bad: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  };
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${colors[tone]}`}>
      {children}
    </span>
  );
}
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function EmptyState({ text = "No records match this view." }: { text?: string }) {
  return (
    <div className="border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--muted)]">
      {text}
    </div>
  );
}
export function DataTable({
  columns,
  rows,
  empty = "No records match this view.",
}: {
  columns: { key: string; label: string; render?: (row: Record<string, unknown>) => ReactNode }[];
  rows: Record<string, unknown>[];
  empty?: string;
}) {
  if (!rows.length) return <EmptyState text={empty} />;
  return (
    <div className="overflow-x-auto border border-[var(--line)] bg-[var(--panel)]">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-[var(--line)] bg-zinc-50/70 text-xs text-[var(--muted)] dark:bg-zinc-900/70">
          <tr>
            {columns.map((c) => (
              <th className="px-4 py-3 font-medium" key={c.key}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--line)]">
          {rows.map((row, i) => (
            <tr key={String(row.id ?? i)} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/60">
              {columns.map((c) => (
                <td className="px-4 py-3" key={c.key}>
                  {c.render ? c.render(row) : String(row[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Pagination({
  page,
  total,
  pageSize,
  basePath,
  query,
}: {
  page: number;
  total: number;
  pageSize: number;
  basePath: string;
  query?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="mt-3 flex items-center justify-between text-xs text-[var(--muted)]">
      <span>
        {total
          ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`
          : "0 records"}
      </span>
      <div className="flex gap-1">
        <Link
          className={`focus-ring border border-[var(--line)] p-1.5 ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
          href={`${basePath}?${query ? `q=${encodeURIComponent(query)}&` : ""}page=${page - 1}`}
        >
          <ChevronLeft size={14} />
        </Link>
        <Link
          className={`focus-ring border border-[var(--line)] p-1.5 ${page >= pages ? "pointer-events-none opacity-40" : ""}`}
          href={`${basePath}?${query ? `q=${encodeURIComponent(query)}&` : ""}page=${page + 1}`}
        >
          <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  );
}
export function SearchBox({
  placeholder = "Search",
  value = "",
}: {
  placeholder?: string;
  value?: string;
}) {
  return (
    <div className="flex items-center gap-2 border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm">
      <Search size={15} className="text-[var(--muted)]" />
      <input
        name="q"
        defaultValue={value}
        placeholder={placeholder}
        className="w-full bg-transparent outline-none placeholder:text-[var(--muted)]"
      />
    </div>
  );
}
