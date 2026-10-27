import { ModuleDetail } from "@/components/module-detail";
import { requireStaff } from "@/lib/data";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  return <ModuleDetail module="timetable" id={id} />;
}
