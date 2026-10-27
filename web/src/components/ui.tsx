import Link from "next/link";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { formatLabel } from "@/lib/format";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const colors = {
    neutral: "bg-zinc-100 text-zinc-700",
    good: "bg-emerald-50 text-emerald-700",
    warn: "bg-amber-50 text-amber-700",
    bad: "bg-rose-50 text-rose-700",
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
    <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--panel)] p-8 text-center text-sm text-[var(--muted)]">
      {text}
    </div>
  );
}
export function DataTable({
  columns,
  rows,
  empty = "No records match this view.",
  rowHref,
}: {
  columns: { key: string; label: string; render?: (row: Record<string, unknown>) => ReactNode }[];
  rows: Record<string, unknown>[];
  empty?: string;
  rowHref?: (row: Record<string, unknown>) => string | undefined;
}) {
  if (!rows.length) return <EmptyState text={empty} />;
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-[var(--line)] bg-[#fafafa] text-xs text-[var(--muted)]">
          <tr>
            {columns.map((c) => (
              <th className="px-4 py-3 font-medium" key={c.key}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--line)]">
          {rows.map((row, i) => {
            const href = rowHref?.(row);
            return (
              <tr
                key={String(row.id ?? i)}
                className={`relative hover:bg-[#f4f4f5] ${href ? "cursor-pointer" : ""}`}
              >
                {columns.map((c, index) => (
                  <td className="px-4 py-3" key={`${c.key}-${index}`}>
                    {href && index === 0 ? (
                      // One link per row, stretched over the whole row, so cells never nest anchors.
                      <Link
                        className="focus-ring after:absolute after:inset-0 after:content-['']"
                        href={href}
                      >
                        {c.render ? c.render(row) : formatLabel(row[c.key])}
                      </Link>
                    ) : c.render ? (
                      c.render(row)
                    ) : (
                      formatLabel(row[c.key])
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
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
  extra,
}: {
  page: number;
  total: number;
  pageSize: number;
  basePath: string;
  query?: string;
  extra?: Record<string, string>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const link = (p: number) => {
    const sp = new URLSearchParams(extra);
    if (query) sp.set("q", query);
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };
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
          href={link(page - 1)}
        >
          <ChevronLeft size={14} />
        </Link>
        <Link
          className={`focus-ring border border-[var(--line)] p-1.5 ${page >= pages ? "pointer-events-none opacity-40" : ""}`}
          href={link(page + 1)}
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
