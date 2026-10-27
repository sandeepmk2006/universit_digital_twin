export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Loading">
      <div className="h-7 w-48 rounded bg-zinc-100" />
      <div className="h-10 max-w-md rounded border border-[var(--line)] bg-white" />
      <div className="h-72 rounded border border-[var(--line)] bg-white" />
    </div>
  );
}
