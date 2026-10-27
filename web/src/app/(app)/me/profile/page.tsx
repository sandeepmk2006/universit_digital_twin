import { UserRound } from "lucide-react";
import { Card, InfoGrid, SectionHeader } from "@/components/section";
import { getStudentContext } from "@/components/student/context";
import { formatDate, formatStatus } from "@/lib/format";
import { rowsFrom } from "@/types/db";

const TABS = [
  { key: "personal", label: "Personal Details" },
  { key: "address", label: "Address for Communication" },
  { key: "admission", label: "Admission Details" },
  { key: "parents", label: "Parent / Guardian" },
];

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const tab = (await searchParams).tab ?? "personal";
  const {
    id,
    supabase,
    student: s,
    programme,
    programmeName,
    subtitle,
  } = await getStudentContext();
  const [guardians, hostel] = await Promise.all([
    supabase.from("guardians").select("name,relation,phone,email").eq("student_id", id),
    supabase.from("hostel_allocations").select("id").eq("student_id", id).is("to_date", null),
  ]);
  const g = rowsFrom(guardians.data);
  const father = g.find((x) => x.relation === "father");
  const mother = g.find((x) => x.relation === "mother");
  const hosteller = rowsFrom(hostel.data).length > 0;
  const lateral = s.admission_type === "Lateral Entry";
  const batch = Number(s.batch_year);

  return (
    <>
      <SectionHeader
        icon={<UserRound size={22} />}
        title="Personal Information"
        subtitle={subtitle}
        tabs={TABS}
        activeTab={tab}
        baseHref="/me/profile"
      />
      {tab === "personal" && (
        <Card title="Personal Details">
          <InfoGrid
            items={[
              ["Student Name", s.full_name],
              ["Hosteller", hosteller ? "Yes" : "No"],
              ["Register Number", s.roll_no],
              ["Student Status", formatStatus(s.status)],
              ["Gender", formatStatus(s.gender)],
              ["Date of Birth", formatDate(s.date_of_birth as string)],
              ["Mobile No", s.mobile],
              ["Nationality", s.nationality],
              ["Official eMail", s.email],
              ["Blood Group", s.blood_group],
              ["Programme", programme],
              ["Current Semester", `Semester ${String(s.current_semester)}`],
            ]}
          />
        </Card>
      )}
      {tab === "address" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {["Permanent Address", "Communication Address"].map((title) => (
            <Card key={title} title={title}>
              <InfoGrid
                items={[
                  ["Contact Person", father?.name ?? s.full_name],
                  ["Address", s.address],
                  ["City", s.city],
                  ["Pincode", s.pincode],
                  ["Mobile No", title.startsWith("Permanent") ? father?.phone : s.mobile],
                ]}
              />
            </Card>
          ))}
        </div>
      )}
      {tab === "admission" && (
        <Card title="Admission Details">
          <InfoGrid
            items={[
              ["Admission Batch", `${batch}-${String(batch + 1).slice(2)} Admissions`],
              ["Programme", programmeName],
              ["Admitted Semester", `Semester ${lateral ? 3 : 1}`],
              ["Current Semester", `Semester ${String(s.current_semester)}`],
              ["Admission Type", s.admission_type],
              ["Date of Admission", formatDate(s.admission_date as string)],
            ]}
          />
        </Card>
      )}
      {tab === "parents" && (
        <Card title="Parent / Guardian">
          <InfoGrid
            items={[
              ["Father Name", father?.name],
              ["Mother Name", mother?.name],
              ["Father Mobile", father?.phone],
              ["Mother Mobile", mother?.phone],
            ]}
          />
        </Card>
      )}
    </>
  );
}
