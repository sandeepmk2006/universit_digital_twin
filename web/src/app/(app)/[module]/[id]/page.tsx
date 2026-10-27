import { ModuleDetail } from "@/components/module-detail";
import { requireModule } from "@/lib/data";

export default async function Page({
  params,
}: {
  params: Promise<{ module: string; id: string }>;
}) {
  const { module, id } = await params;
  await requireModule(module);
  return <ModuleDetail module={module} id={id} />;
}
