import { ModuleDetail } from "@/components/module-detail";
import { RecordFormPage } from "@/components/record-form-page";

// Any signed-in user may view an individual faculty profile (e.g. a student's
// mentor or course instructor); only the administrator can add or edit one.
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (id === "new") return <RecordFormPage module="faculty" />;
  if (sp.edit) return <RecordFormPage module="faculty" id={id} />;
  return <ModuleDetail module="faculty" id={id} />;
}
