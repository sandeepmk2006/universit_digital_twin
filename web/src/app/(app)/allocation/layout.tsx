import { requireStaff } from "@/lib/data";

export default async function AllocationLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return <>{children}</>;
}
