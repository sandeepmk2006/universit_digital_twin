import { redirect } from "next/navigation";
import { ModuleDetail } from "@/components/module-detail";
import { createClient } from "@/lib/supabase/server";
import { getProfile, requireModule } from "@/lib/data";
import { canWrite, WRITABLE } from "@/lib/permissions";
import { RecordForm } from "@/components/record-form";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ module: string; id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { module, id } = await params;
  const sp = await searchParams;
  await requireModule(module);
  const spec = WRITABLE[module];

  // Add a new record.
  if (id === "new" && spec) {
    const profile = await getProfile();
    if (!canWrite(profile?.role, module)) redirect(`/${module}`);
    return (
      <RecordForm
        module={module}
        label={spec.label}
        fields={spec.fields}
        mode="create"
        backHref={`/${module}`}
      />
    );
  }

  // Edit an existing record.
  if (sp.edit && spec) {
    const profile = await getProfile();
    if (canWrite(profile?.role, module)) {
      const supabase = await createClient();
      const cols = ["id", ...spec.fields.map((f) => f.name)].join(",");
      const { data } = await supabase.from(spec.table).select(cols).eq("id", id).maybeSingle();
      if (data) {
        return (
          <RecordForm
            module={module}
            label={spec.label}
            fields={spec.fields}
            mode="edit"
            id={id}
            defaults={data as unknown as Record<string, unknown>}
            backHref={`/${module}/${id}`}
          />
        );
      }
    }
  }

  return <ModuleDetail module={module} id={id} />;
}
