import { FileText } from "lucide-react";
import { Badge, DataTable } from "@/components/ui";
import { Card, SectionHeader } from "@/components/section";
import { BonafideForm, RequestButton } from "@/components/student/forms";
import { getStudentContext } from "@/components/student/context";
import { formatDate, formatMoney, formatStatus } from "@/lib/format";
import { rowsFrom } from "@/types/db";

const TABS = [
  { key: "bonafide", label: "Bonafide Certificate" },
  { key: "services", label: "Service Requests" },
  { key: "mine", label: "My Requests" },
];

const SERVICES: Array<[string, number]> = [
  ["Identity card with tag", 300],
  ["Identity card tag", 30],
  ["Migration certificate", 400],
  ["Duplicate certificate - degree", 2000],
  ["Course completion certificate", 250],
  ["Official transcript", 1500],
  ["Conduct certificate", 100],
];

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const tab = (await searchParams).tab ?? "bonafide";
  const { id, supabase, subtitle } = await getStudentContext();
  const [{ data: mine }, { data: hostel }] = await Promise.all([
    supabase
      .from("service_requests")
      .select("id,service,purpose,fee,status,created_at")
      .eq("student_id", id)
      .order("created_at", { ascending: false }),
    supabase.rpc("my_hostel"),
  ]);
  const h = rowsFrom(hostel)[0];
  return (
    <>
      <SectionHeader
        icon={<FileText size={22} />}
        title="Requests"
        subtitle={subtitle}
        tabs={TABS}
        activeTab={tab}
        baseHref="/me/requests"
      />
      {tab === "bonafide" && (
        <Card title="Bonafide Application">
          <BonafideForm
            hostel={String(h?.hostel ?? "Day scholar")}
            room={String(h?.room_no ?? "—")}
          />
        </Card>
      )}
      {tab === "services" && (
        <Card title="Service Requests">
          <DataTable
            rows={SERVICES.map(([name, fee], i) => ({ id: i + 1, name, fee }))}
            columns={[
              { key: "id", label: "#" },
              { key: "name", label: "Service" },
              { key: "fee", label: "Amount", render: (r) => formatMoney(r.fee as number) },
              {
                key: "last",
                label: "Registration Last Date",
                render: () => formatDate("2026-12-30"),
              },
              {
                key: "action",
                label: "Action",
                render: (r) => <RequestButton service={String(r.name)} fee={Number(r.fee)} />,
              },
            ]}
          />
        </Card>
      )}
      {tab === "mine" && (
        <Card title="My Requests">
          <DataTable
            rows={rowsFrom(mine)}
            columns={[
              {
                key: "created_at",
                label: "Requested",
                render: (r) => formatDate(String(r.created_at)),
              },
              { key: "service", label: "Service" },
              { key: "purpose", label: "Purpose", render: (r) => String(r.purpose ?? "—") },
              { key: "fee", label: "Fee", render: (r) => formatMoney(r.fee as number) },
              {
                key: "status",
                label: "Status",
                render: (r) => (
                  <Badge
                    tone={r.status === "ready" ? "good" : r.status === "rejected" ? "bad" : "warn"}
                  >
                    {formatStatus(r.status)}
                  </Badge>
                ),
              },
            ]}
            empty="You have not raised any requests yet."
          />
        </Card>
      )}
    </>
  );
}
