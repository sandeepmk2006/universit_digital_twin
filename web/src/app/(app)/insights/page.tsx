import { createClient } from "@/lib/supabase/server";
import { RiskChart } from "@/components/charts";
import { Badge, DataTable, PageHeader } from "@/components/ui";
import { rowsFrom } from "@/types/db";
export default async function InsightsPage() {
  const { data } = await (await createClient())
    .from("performance_predictions")
    .select(
      "id,student_id,predicted_gpa,risk_level,model_version,created_at,students(full_name,roll_no)",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = data ?? [];
  const counts = ["low", "medium", "high"].map((name) => ({
    name,
    value: rows.filter((r) => r.risk_level === name).length,
  }));
  return (
    <>
      <PageHeader title="Insights" description="Prediction signals to guide timely intervention." />
      <div className="mb-4 grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="border border-[var(--line)] bg-[var(--panel)] p-4">
          <h2 className="font-medium">Risk distribution</h2>
          <RiskChart data={counts} />
        </div>
        <div className="border border-[var(--line)] bg-[var(--panel)] p-4">
          <h2 className="font-medium">Latest predictions</h2>
          <div className="mt-4">
            <DataTable
              rows={rowsFrom(rows)}
              columns={[
                {
                  key: "students",
                  label: "Student",
                  render: (r) =>
                    String((r.students as { full_name?: string })?.full_name ?? "Unknown"),
                },
                { key: "predicted_gpa", label: "Predicted GPA" },
                {
                  key: "risk_level",
                  label: "Risk",
                  render: (r) => (
                    <Badge
                      tone={
                        r.risk_level === "high"
                          ? "bad"
                          : r.risk_level === "medium"
                            ? "warn"
                            : "good"
                      }
                    >
                      {String(r.risk_level)}
                    </Badge>
                  ),
                },
                { key: "model_version", label: "Model" },
              ]}
              empty="No predictions are available."
            />
          </div>
        </div>
      </div>
    </>
  );
}
