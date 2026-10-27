import { Building2 } from "lucide-react";
import { Card, InfoGrid, SectionHeader } from "@/components/section";
import { getStudentContext } from "@/components/student/context";
import { formatDate, formatTime } from "@/lib/format";
import { rowsFrom } from "@/types/db";

export default async function HostelPage() {
  const { id, supabase, student: s, programme, subtitle } = await getStudentContext();
  const [{ data: hostel }, { data: parents }, { data: pass }] = await Promise.all([
    supabase.rpc("my_hostel"),
    supabase.from("guardians").select("name").eq("student_id", id).eq("relation", "father"),
    supabase
      .from("bus_passes")
      .select("valid_to,bus_stops(name,pickup_at,bus_routes(code,name))")
      .eq("profile_id", String(s.profile_id)),
  ]);
  const h = rowsFrom(hostel)[0];
  const p = rowsFrom(pass)[0];
  const stop = p?.bus_stops as
    | { name: string; pickup_at: string; bus_routes: { code: string; name: string } }
    | undefined;
  const mates = (h?.roommates as string[] | undefined) ?? [];
  const title = h ? "Hostel Details" : "Day Scholar Details";
  return (
    <>
      <SectionHeader
        icon={<Building2 size={22} />}
        title="Hostel"
        subtitle={subtitle}
        tabs={[{ key: "details", label: title }]}
        baseHref="/me/hostel"
      />
      <Card title={title}>
        <InfoGrid
          items={
            h
              ? [
                  ["Register No", s.roll_no],
                  ["Hostel Warden", h.warden],
                  ["Name", s.full_name],
                  ["Hostel Name", h.hostel],
                  ["Programme", programme],
                  ["Room Number", h.room_no],
                  ["Semester", `Semester ${String(s.current_semester)}`],
                  [
                    "Room Mates",
                    mates.length ? (
                      <div className="space-y-1">
                        {mates.map((m) => (
                          <div key={m}>{m}</div>
                        ))}
                      </div>
                    ) : (
                      "None"
                    ),
                  ],
                  ["Parent Name", rowsFrom(parents)[0]?.name],
                  ["Resident Since", formatDate(h.since as string)],
                  ["Days Scholar", "No"],
                ]
              : [
                  ["Register No", s.roll_no],
                  ["Name", s.full_name],
                  ["Days Scholar", "Yes"],
                  [
                    "Bus Route",
                    stop ? `${stop.bus_routes.code} · ${stop.bus_routes.name}` : "No bus pass",
                  ],
                  ["Boarding Stop", stop?.name],
                  ["Pickup Time", stop ? formatTime(stop.pickup_at) : undefined],
                  ["Pass Valid Till", p ? formatDate(p.valid_to as string) : undefined],
                ]
          }
        />
      </Card>
    </>
  );
}
