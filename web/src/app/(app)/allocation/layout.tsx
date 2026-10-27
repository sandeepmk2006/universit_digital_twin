import { requireModule } from "@/lib/data";

export default async function AllocationLayout({ children }: { children: React.ReactNode }) {
  await requireModule("allocation");
  return <>{children}</>;
}
