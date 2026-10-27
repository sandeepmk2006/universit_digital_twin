import { createClient } from "@/lib/supabase/server";
import { DataTable, PageHeader, Badge } from "@/components/ui";
export default async function PlacementsPage() {
  const supabase = await createClient();
  const [drives, apps] = await Promise.all([
    supabase
      .from("placement_drives")
      .select("id,role_title,package_lpa,drive_date,status,companies(name)")
      .order("drive_date", { ascending: true }),
    supabase.from("placement_applications").select("stage"),
  ]);
  const funnel = ["applied", "shortlisted", "test", "interview", "offered"];
  return (
    <>
      <PageHeader
        title="Placements"
        description="Hiring drives and the student application funnel."
      />
      <div className="mb-5 grid gap-2 sm:grid-cols-5">
        {funnel.map((stage) => (
          <div className="border border-[var(--line)] bg-[var(--panel)] p-3" key={stage}>
            <div className="text-xs text-[var(--muted)]">{stage}</div>
            <div className="mt-1 text-xl font-semibold tabular">
              {(apps.data ?? []).filter((a) => a.stage === stage).length}
            </div>
          </div>
        ))}
      </div>
      <DataTable
        rows={(drives.data ?? []) as unknown as Record<string, unknown>[]}
        columns={[
          {
            key: "companies",
            label: "Company",
            render: (r) => String((r.companies as { name?: string })?.name ?? "—"),
          },
          { key: "role_title", label: "Role" },
          { key: "package_lpa", label: "Package (LPA)" },
          { key: "drive_date", label: "Drive date" },
          {
            key: "status",
            label: "Status",
            render: (r) => (
              <Badge tone={r.status === "upcoming" ? "good" : "neutral"}>{String(r.status)}</Badge>
            ),
          },
        ]}
        empty="No placement drives are scheduled."
      />
    </>
  );
}
