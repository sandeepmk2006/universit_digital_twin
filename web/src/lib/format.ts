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
