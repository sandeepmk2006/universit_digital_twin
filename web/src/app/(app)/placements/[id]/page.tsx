import { ModuleDetail } from "@/components/module-detail";
import { requireModule } from "@/lib/data";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("placements");
  const { id } = await params;
  return <ModuleDetail module="placements" id={id} />;
}
