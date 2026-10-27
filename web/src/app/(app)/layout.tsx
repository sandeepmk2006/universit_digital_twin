import { Shell } from "@/components/shell";
import { getProfile } from "@/lib/data";
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  return <Shell profile={await getProfile()}>{children}</Shell>;
}
