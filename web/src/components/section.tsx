import Link from "next/link";
import type { ReactNode } from "react";

// The identity strip + section title that heads every page, like EduServe.
export function SectionHeader({
  icon,
  title,
  subtitle,
  action,
  tabs,
  activeTab,
  baseHref,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  tabs?: { key: string; label: string }[];
  activeTab?: string;
  baseHref?: string;
}) {
  return (
    <section className="mb-4 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-5 py-4 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-dashed border-indigo-200 text-[var(--brand)]">
          {icon}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-[var(--brand)]">{title}</h1>
          {subtitle && <p className="mt-0.5 truncate text-sm text-[var(--muted)]">{subtitle}</p>}
        </div>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {tabs && tabs.length > 0 && (
        <nav className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--line)] pt-3 text-sm">
          {tabs.map((t) => {
            const active = (activeTab ?? tabs[0].key) === t.key;
            const href = t.key === tabs[0].key ? baseHref : `${baseHref}?tab=${t.key}`;
            return (
              <Link
                key={t.key}
                href={href ?? "#"}
                className={
                  active
                    ? "border-b-2 border-[var(--brand)] pb-2 font-medium text-[var(--brand)]"
                    : "pb-2 text-[var(--muted)] hover:text-[var(--ink)]"
                }
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      )}
    </section>
  );
}

// A white content card with a blue title and an optional right-hand control.
export function Card({
  title,
  right,
  children,
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
      {(title || right) && (
        <div className="mb-4 flex items-center justify-between gap-4">
          {title && <h2 className="text-lg font-semibold text-[var(--brand)]">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

type Tone = "indigo" | "green" | "amber" | "rose";
const toneText: Record<Tone, string> = {
  indigo: "text-indigo-600",
  green: "text-emerald-600",
  amber: "text-amber-600",
  rose: "text-rose-600",
};
const toneBorder: Record<Tone, string> = {
  indigo: "border-indigo-100",
  green: "border-emerald-100",
  amber: "border-amber-100",
  rose: "border-rose-100",
};

// EduServe-style KPI box: outlined, coloured label, big value.
export function StatBox({
  label,
  value,
  tone = "indigo",
  href,
}: {
  label: string;
  value: unknown;
  tone?: Tone;
  href?: string;
}) {
  const inner = (
    <>
      <div className={`text-sm font-medium ${toneText[tone]}`}>{label}</div>
      <div className="mt-1 text-2xl font-bold tabular text-[var(--ink)]">
        {(value ?? "—") as ReactNode}
      </div>
    </>
  );
  const cls = `rounded-lg border ${toneBorder[tone]} bg-[var(--panel)] px-5 py-4 text-center`;
  return href ? (
    <Link href={href} className={`${cls} block transition hover:border-indigo-300`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function StatRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

// Two-column label / value grid, like EduServe's "Personal Details".
export function InfoGrid({ items }: { items: Array<[string, unknown]> }) {
  return (
    <dl className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[minmax(120px,40%)_1fr] gap-3">
          <dt className="text-sm text-[var(--muted)]">{label}</dt>
          <dd className="text-sm font-medium text-[var(--ink)]">
            {(value === null || value === undefined || value === "" ? "—" : value) as ReactNode}
          </dd>
        </div>
      ))}
    </dl>
  );
}
