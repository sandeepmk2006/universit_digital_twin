import { PlacementChart } from "@/components/charts";
import { Badge, DataTable, PageHeader } from "@/components/ui";
import { formatDate, formatStatus } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Row } from "@/types/db";

export default async function PlacementsPage() {
  const { data } = await (await createClient())
    .from("v_placement_funnel")
    .select("id,company,role_title,package_lpa,drive_date,status,applied,progressed,offers")
    .order("drive_date", { ascending: true });
  const rows = (data ?? []) as Row[];
  const totals = ["applied", "progressed", "offers"].map((key) => ({
    key,
    value: rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0),
  }));
  const companies = rows
    .map((row) => ({ name: String(row.company), value: Number(row.offers ?? 0) }))
    .filter((row) => row.value > 0);
  return (
    <>
      <PageHeader
        title="Placements"
        description="Hiring drives and the student application funnel."
      />
      <div className="mb-5 grid gap-2 sm:grid-cols-3">
        {totals.map((item) => (
          <div key={item.key} className="border border-[var(--line)] bg-[var(--panel)] p-3">
            <div className="text-xs text-[var(--muted)]">{item.key}</div>
            <div className="mt-1 text-xl font-semibold tabular">{item.value}</div>
          </div>
        ))}
      </div>
      <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <section className="border border-[var(--line)] bg-[var(--panel)] p-4">
          <h2 className="font-medium">Offers by company</h2>
          <PlacementChart data={companies} />
        </section>
        <DataTable
          rows={rows}
          columns={[
            { key: "company", label: "Company" },
            { key: "role_title", label: "Role" },
            { key: "package_lpa", label: "Package (LPA)" },
            {
              key: "drive_date",
              label: "Drive date",
              render: (r) => formatDate(String(r.drive_date)),
            },
            {
              key: "status",
              label: "Status",
              render: (r) => (
                <Badge tone={r.status === "open" ? "good" : "neutral"}>
                  {formatStatus(r.status)}
                </Badge>
              ),
            },
            { key: "offers", label: "Offers" },
          ]}
          rowHref={(row) => `/placements/${String(row.id)}`}
          empty="No placement drives are scheduled."
        />
      </div>
    </>
  );
}
