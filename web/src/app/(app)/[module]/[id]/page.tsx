import { redirect } from "next/navigation";
import { ModuleDetail } from "@/components/module-detail";
import { getProfile, isStaff, STUDENT_MODULES } from "@/lib/data";

export default async function Page({
  params,
}: {
  params: Promise<{ module: string; id: string }>;
}) {
  const { module, id } = await params;
  const profile = await getProfile();
  if (!isStaff(profile?.role) && !STUDENT_MODULES.has(module)) redirect("/");
  return <ModuleDetail module={module} id={id} />;
}
