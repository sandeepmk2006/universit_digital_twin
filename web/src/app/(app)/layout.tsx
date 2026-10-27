import { Shell } from "@/components/shell";
import { getCurrentTerm, getProfile } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [profile, term] = await Promise.all([getProfile(), getCurrentTerm()]);
  return (
    <Shell profile={profile} term={term}>
      {children}
    </Shell>
  );
}
