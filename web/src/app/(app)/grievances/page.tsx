import { createClient } from "@/lib/supabase/server";
import { Badge, DataTable, PageHeader } from "@/components/ui";
export default async function GrievancesPage() {
  const { data } = await (await createClient())
    .from("grievances")
    .select("id,category,subject,status,is_anonymous,created_at")
    .order("created_at", { ascending: false });
  return (
    <>
      <PageHeader
        title="Grievances"
        description="Track issues through assignment and resolution."
      />
      <DataTable
        rows={(data ?? []) as unknown as Record<string, unknown>[]}
        columns={[
          { key: "subject", label: "Subject" },
          { key: "category", label: "Category" },
          { key: "created_at", label: "Raised" },
          {
            key: "status",
            label: "Status",
            render: (r) => (
              <Badge
                tone={
                  r.status === "resolved" || r.status === "closed"
                    ? "good"
                    : r.status === "open"
                      ? "warn"
                      : "neutral"
                }
              >
                {String(r.status)}
              </Badge>
            ),
          },
        ]}
        empty="No grievances have been filed."
      />
    </>
  );
}
