import { ModuleList } from "@/components/module-list";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; q?: string; year?: string; dept?: string }>;
}) {
  const sp = await searchParams;
  return <ModuleList module="placements" tab={sp.tab} page={sp.page} q={sp.q} year={sp.year} dept={sp.dept} />;
}
