import { Wallet } from "lucide-react";
import { Badge, DataTable } from "@/components/ui";
import { Card, SectionHeader, StatBox, StatRow } from "@/components/section";
import { getStudentContext } from "@/components/student/context";
import { formatDate, formatMoney, formatStatus } from "@/lib/format";
import { rowsFrom, type Row } from "@/types/db";

const TABS = [
  { key: "statement", label: "Overall Fees Statement" },
  { key: "receipts", label: "Payment / Receipts History" },
];

export default async function FeesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const tab = (await searchParams).tab ?? "statement";
  const { id, supabase, student: s, subtitle } = await getStudentContext();

  const [inv, sch, fees, hostel, pass] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "id,amount,due_on,status,term_id,academic_terms(name),payments(amount,method,reference,paid_at)",
      )
      .eq("student_id", id),
    supabase.from("scholarships").select("name,amount").eq("student_id", id),
    supabase
      .from("fee_structures")
      .select("component,amount,academic_terms!inner(is_current,name)")
      .eq("program_id", String(s.program_id))
      .eq("academic_terms.is_current", true),
    supabase.from("hostel_allocations").select("id").eq("student_id", id).is("to_date", null),
    supabase.from("bus_passes").select("id").eq("profile_id", String(s.profile_id)),
  ]);

  const invoices = rowsFrom(inv.data);
  const payments: Row[] = invoices.flatMap((i) =>
    rowsFrom(i.payments).map((p) => ({
      ...p,
      term: (i.academic_terms as { name: string } | null)?.name,
    })),
  );
  const billed = invoices.reduce((n, i) => n + Number(i.amount), 0);
  const paid = payments.reduce((n, p) => n + Number(p.amount), 0);
  const scholarship = rowsFrom(sch.data).reduce((n, r) => n + Number(r.amount), 0);
  const due = Math.max(0, billed - paid - scholarship);
  const current = invoices[0];

  const lines: Row[] = [
    ...rowsFrom(fees.data).map((f) => ({ desc: `${String(f.component)} fee`, amount: f.amount })),
    ...(rowsFrom(hostel.data).length ? [{ desc: "Hostel and mess fee", amount: 62000 }] : []),
    ...(rowsFrom(pass.data).length ? [{ desc: "Transport (bus pass) fee", amount: 14000 }] : []),
  ].map((l) => ({
    ...l,
    semester: `Semester ${String(s.current_semester)}`,
    last: current?.due_on,
    status: current?.status,
  }));

  return (
    <>
      <SectionHeader
        icon={<Wallet size={22} />}
        title="Fees"
        subtitle={subtitle}
        tabs={TABS}
        activeTab={tab}
        baseHref="/me/fees"
      />
      <div className="mb-4">
        <StatRow>
          <StatBox label="Total Due" value={formatMoney(due)} tone={due ? "rose" : "green"} />
          <StatBox label="Total Paid" value={formatMoney(paid)} tone="green" />
          <StatBox label="Total Scholarship" value={formatMoney(scholarship)} tone="indigo" />
          <StatBox label="Billed this year" value={formatMoney(billed)} />
        </StatRow>
      </div>
      {tab === "statement" && (
        <Card title="Overall Fees Statement">
          <DataTable
            rows={lines}
            columns={[
              {
                key: "desc",
                label: "Fee Description",
                render: (r) => String(r.desc).toUpperCase(),
              },
              { key: "semester", label: "Semester" },
              { key: "amount", label: "To Pay", render: (r) => formatMoney(r.amount as number) },
              { key: "last", label: "Last Date", render: (r) => formatDate(String(r.last)) },
              {
                key: "status",
                label: "Status",
                render: (r) => (
                  <Badge
                    tone={r.status === "paid" ? "good" : r.status === "partial" ? "warn" : "bad"}
                  >
                    {formatStatus(r.status)}
                  </Badge>
                ),
              },
            ]}
            empty="No fees have been levied this term."
          />
          {rowsFrom(sch.data).length > 0 && (
            <p className="mt-3 text-sm text-[var(--muted)]">
              Scholarship applied:{" "}
              {rowsFrom(sch.data)
                .map((r) => `${String(r.name)} (${formatMoney(r.amount as number)})`)
                .join(", ")}
            </p>
          )}
        </Card>
      )}
      {tab === "receipts" && (
        <Card title="Download Fee Receipts">
          <DataTable
            rows={payments}
            columns={[
              { key: "paid_at", label: "Date", render: (r) => formatDate(String(r.paid_at)) },
              { key: "reference", label: "Receipt No." },
              {
                key: "term",
                label: "Description",
                render: (r) => `Fee payment — ${String(r.term)} Semester`,
              },
              { key: "method", label: "Mode", render: (r) => formatStatus(r.method).toUpperCase() },
              {
                key: "amount",
                label: "Total Amount",
                render: (r) => formatMoney(r.amount as number),
              },
            ]}
            empty="No payments recorded yet."
          />
        </Card>
      )}
    </>
  );
}
