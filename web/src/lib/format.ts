export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const text = value instanceof Date ? value.toISOString() : value;
  const match = text.match(/(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : formatDate(value);
}

export function formatMoney(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export function formatPercent(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toFixed(1)}%`;
}

export function formatStatus(value: unknown) {
  return String(value ?? "unknown").replace(/_/g, " ");
}

const WEEKDAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function formatWeekday(value: unknown) {
  return WEEKDAYS[Number(value)] ?? "—";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown) {
  return typeof value === "string" && UUID.test(value);
}

/** Human label for a value that may be a joined PostgREST object or array of them. */
export function formatLabel(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.map(formatLabel).join(", ") : "—";
  if (typeof value === "object") {
    const row = value as Record<string, unknown>;
    if (row.courses)
      return formatLabel(row.courses) + (row.section ? ` · ${String(row.section)}` : "");
    if (row.code && row.title) return `${String(row.code)} · ${String(row.title)}`;
    if (row.books) return formatLabel(row.books);
    if (row.package_lpa !== undefined) return `${String(row.package_lpa)} LPA`;
    if (row.text) return String(row.text);
    const label =
      row.full_name ?? row.name ?? row.title ?? row.code ?? row.registration ?? row.barcode;
    return label === undefined || label === null ? "—" : String(label);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return isUuid(value) ? "—" : String(value);
}
