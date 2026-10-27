import { CalendarCheck } from "lucide-react";
import { Badge, DataTable } from "@/components/ui";
import { Card, SectionHeader } from "@/components/section";
import { LeaveForm } from "@/components/student/forms";
import { getStudentContext } from "@/components/student/context";
import { formatDate, formatStatus } from "@/lib/format";
import { rowsFrom } from "@/types/db";

const TABS = [
  { key: "history", label: "Leave History" },
  { key: "apply", label: "Apply Leave" },
];

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const tab = (await searchParams).tab ?? "history";
  const { id, supabase, subtitle, term } = await getStudentContext();
  const { data } = await supabase
    .from("leave_requests")
    .select(
      "id,leave_type,subject,reason,from_date,to_date,from_session,to_session,status,created_at",
    )
    .eq("student_id", id)
    .order("created_at", { ascending: false });
  return (
    <>
      <SectionHeader
        icon={<CalendarCheck size={22} />}
        title="Leave"
        subtitle={subtitle}
        tabs={TABS}
        activeTab={tab}
        baseHref="/me/leave"
      />
      {tab === "history" ? (
        <Card title="Leave History">
          <DataTable
            rows={rowsFrom(data)}
            columns={[
              { key: "leave_type", label: "Leave Type", render: (r) => formatStatus(r.leave_type) },
              { key: "subject", label: "Reason", render: (r) => String(r.reason ?? r.subject) },
              {
                key: "from_date",
                label: "From Date",
                render: (r) => formatDate(String(r.from_date)),
              },
              {
                key: "from_session",
                label: "From Session",
                render: (r) => formatStatus(r.from_session),
              },
              { key: "to_date", label: "To Date", render: (r) => formatDate(String(r.to_date)) },
              { key: "to_session", label: "To Session", render: (r) => formatStatus(r.to_session) },
              {
                key: "status",
                label: "Status",
                render: (r) => (
                  <Badge
                    tone={
                      r.status === "approved" ? "good" : r.status === "rejected" ? "bad" : "warn"
                    }
                  >
                    {formatStatus(r.status)}
                  </Badge>
                ),
              },
            ]}
            empty="You have not applied for any leave. Use Apply Leave to request one."
          />
        </Card>
      ) : (
        <Card title="Leave Apply Form">
          <LeaveForm termName={term?.name ?? ""} />
        </Card>
      )}
    </>
  );
}
