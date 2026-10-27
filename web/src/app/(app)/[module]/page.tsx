import { ModuleList } from "@/components/module-list";

export default async function ModulePage({
  params,
  searchParams,
}: {
  params: Promise<{ module: string }>;
  searchParams: Promise<{ tab?: string; page?: string; q?: string }>;
}) {
  const { module } = await params;
  const sp = await searchParams;
  return <ModuleList module={module} tab={sp.tab} page={sp.page} q={sp.q} />;
}
