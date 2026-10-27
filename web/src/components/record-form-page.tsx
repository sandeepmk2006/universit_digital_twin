import { notFound, redirect } from "next/navigation";
import { RecordForm } from "@/components/record-form";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/data";
import { resolveFields } from "@/lib/forms";
import { canWrite, WRITABLE } from "@/lib/permissions";

// The add (no id) or edit (id) page for any writable module.
export async function RecordFormPage({ module, id }: { module: string; id?: string }) {
  const spec = WRITABLE[module];
  const profile = await getProfile();
  if (!spec || !canWrite(profile?.role, module)) redirect(id ? `/${module}/${id}` : `/${module}`);
  const fields = await resolveFields(spec.fields);
  if (!id) {
    return (
      <RecordForm
        module={module}
        label={spec.label}
        fields={fields}
        mode="create"
        backHref={`/${module}`}
      />
    );
  }
  const supabase = await createClient();
  const cols = ["id", ...spec.fields.map((f) => f.name)].join(",");
  const { data } = await supabase.from(spec.table).select(cols).eq("id", id).maybeSingle();
  if (!data) notFound();
  return (
    <RecordForm
      module={module}
      label={spec.label}
      fields={fields}
      mode="edit"
      id={id}
      defaults={data as unknown as Record<string, unknown>}
      backHref={`/${module}/${id}`}
    />
  );
}
