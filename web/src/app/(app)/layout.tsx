import { Shell } from "@/components/shell";
import { getCurrentTerm, getMyStudentId, getProfile } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [profile, term] = await Promise.all([getProfile(), getCurrentTerm()]);
  const studentId = profile?.role === "student" ? await getMyStudentId() : null;
  return (
    <Shell profile={profile} term={term} studentId={studentId}>
      {children}
    </Shell>
  );
}
