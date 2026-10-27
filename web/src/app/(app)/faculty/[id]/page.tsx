import { ModuleDetail } from "@/components/module-detail";

// Any signed-in user may view an individual faculty profile (e.g. a student's
// mentor or course instructor). The faculty directory list stays staff-only.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ModuleDetail module="faculty" id={id} />;
}
