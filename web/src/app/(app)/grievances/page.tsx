import { ModuleList } from "@/components/module-list";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; q?: string }>;
}) {
  const sp = await searchParams;
  return <ModuleList module="grievances" tab={sp.tab} page={sp.page} q={sp.q} />;
}
