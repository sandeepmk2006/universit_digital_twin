import { ModuleDetail } from "@/components/module-detail";
import { RecordFormPage } from "@/components/record-form-page";
import { requireModule } from "@/lib/data";

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
  if (id === "new") return <RecordFormPage module={module} />;
  if (sp.edit) return <RecordFormPage module={module} id={id} />;
  return <ModuleDetail module={module} id={id} />;
}
