import { DataTable } from "@/components/ui";
import { Card, SectionHeader, StatBox, StatRow } from "@/components/section";
import {
  BookOpen,
  Bus,
  ClipboardList,
  GraduationCap,
  Heart,
  Home,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { formatDate, formatMoney, formatPercent, formatTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getMyDepartment } from "@/lib/data";
import { rowsFrom, type Row } from "@/types/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReactNode } from "react";

type DB = SupabaseClient;

async function count(db: DB, table: string, build?: (q: any) => any): Promise<number> {
  let q: any = db.from(table).select("*", { count: "exact", head: true });
  if (build) q = build(q);
  const { count } = await q;
  return count ?? 0;
}

const TONES = ["indigo", "green", "amber", "rose"] as const;

function Head({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return <SectionHeader icon={icon} title={title} subtitle={subtitle} />;
}

function Tiles({ items }: { items: Array<[string, ReactNode, string?]> }) {
  return (
    <StatRow>
      {items.map(([label, value, href], i) => (
        <StatBox
          key={label}
          label={label}
          value={value}
          href={href}
          tone={TONES[i % TONES.length]}
        />
      ))}
    </StatRow>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <Card title={title}>{children}</Card>
    </div>
  );
}

// ---- Faculty: only their own sections, students and mentees ------------------

export async function FacultyDashboard({ facultyId, name }: { facultyId: string; name: string }) {
  const db = await createClient();
  const [sections, mentees, today] = await Promise.all([
    db
      .from("v_section_catalogue")
      .select("id,code,title,section,semester,enrolled,capacity")
      .eq("faculty_id", facultyId)
      .eq("is_current", true),
    db
      .from("v_student_directory")
      .select("id,roll_no,full_name,department,attendance_pct,risk_level")
      .eq("mentor_id", facultyId),
    db
      .from("v_timetable")
      .select("id,section_id,course_code,course_title,section,starts_at,ends_at,room")
      .eq("faculty_id", facultyId)
      .eq("is_current", true)
      .eq("weekday", new Date().getDay() || 7)
      .order("starts_at"),
  ]);
  const sectionRows = rowsFrom(sections.data);
  const menteeRows = rowsFrom(mentees.data);
  const atRisk = menteeRows.filter((m) => m.risk_level === "high").length;
  const taught = sectionRows.reduce((n, r) => n + Number(r.enrolled ?? 0), 0);
  return (
    <>
      <Head
        icon={<GraduationCap size={22} />}
        title={`Welcome, ${name.split(" ")[0]}`}
        subtitle="Your teaching workload this term."
      />
      <Tiles
        items={[
          ["Sections", sectionRows.length],
          ["Students taught", taught],
          ["Mentees", menteeRows.length],
          ["Mentees at risk", atRisk],
        ]}
      />
      <Panel title="Today's classes">
        <DataTable
          rows={rowsFrom(today.data)}
          rowHref={(r) => `/courses/${String(r.section_id)}`}
          columns={[
            {
              key: "starts_at",
              label: "Time",
              render: (r) => `${formatTime(String(r.starts_at))}–${formatTime(String(r.ends_at))}`,
            },
            {
              key: "course_code",
              label: "Course",
              render: (r) => `${String(r.course_code)} · ${String(r.course_title)}`,
            },
            { key: "section", label: "Section" },
            { key: "room", label: "Room", render: (r) => String(r.room ?? "Unassigned") },
          ]}
          empty="No classes scheduled today."
        />
      </Panel>
      <Panel title="My sections">
        <DataTable
          rows={sectionRows}
          rowHref={(r) => `/courses/${String(r.id)}`}
          columns={[
            {
              key: "code",
              label: "Course",
              render: (r) => `${String(r.code)} · ${String(r.title)}`,
            },
            { key: "section", label: "Section" },
            { key: "semester", label: "Sem." },
            {
              key: "enrolled",
              label: "Enrolled",
              render: (r) => `${String(r.enrolled)} / ${String(r.capacity)}`,
            },
          ]}
          empty="You are not assigned to any sections this term."
        />
      </Panel>
      <Panel title="My mentees">
        <DataTable
          rows={menteeRows}
          rowHref={(r) => `/students/${String(r.id)}`}
          columns={[
            { key: "roll_no", label: "Roll no." },
            { key: "full_name", label: "Student" },
            {
              key: "attendance_pct",
              label: "Attendance",
              render: (r) => (
                <span className={Number(r.attendance_pct) < 75 ? "text-rose-600" : ""}>
                  {formatPercent(r.attendance_pct as number)}
                </span>
              ),
            },
            { key: "risk_level", label: "Risk", render: (r) => String(r.risk_level ?? "—") },
          ]}
          empty="You have no assigned mentees."
        />
      </Panel>
    </>
  );
}

// ---- HOD: their department ---------------------------------------------------

export async function HodDashboard() {
  const db = await createClient();
  const dept = await getMyDepartment();
  const code = (dept?.departments as { code?: string; name?: string } | null)?.code ?? "";
  const name = (dept?.departments as { name?: string } | null)?.name ?? "Department";
  const [students, faculty, attn, highRisk] = await Promise.all([
    count(db, "v_student_directory", (q) => q.eq("department", code).eq("status", "active")),
    count(db, "faculty", (q) => q.eq("department_id", dept?.department_id).eq("is_active", true)),
    db
      .from("v_department_attendance")
      .select("attendance_pct")
      .eq("department", code)
      .maybeSingle(),
    count(db, "v_student_directory", (q) => q.eq("department", code).eq("risk_level", "high")),
  ]);
  return (
    <>
      <Head
        icon={<GraduationCap size={22} />}
        title={name}
        subtitle="Department overview for this term."
      />
      <Tiles
        items={[
          ["Students", students, "/students"],
          ["Faculty", faculty, "/faculty"],
          ["Attendance", formatPercent(attn.data?.attendance_pct)],
          ["High-risk students", highRisk, "/insights"],
        ]}
      />
    </>
  );
}

// ---- Single-domain staff dashboards -----------------------------------------

export async function WardenDashboard() {
  const db = await createClient();
  const [hostels, residents, beds, open] = await Promise.all([
    count(db, "hostels"),
    count(db, "hostel_allocations", (q) => q.is("to_date", null)),
    db
      .from("hostel_rooms")
      .select("beds")
      .then((r) => rowsFrom(r.data).reduce((n, x) => n + Number(x.beds), 0)),
    count(db, "hostel_complaints", (q) => q.in("status", ["open", "in_progress"])),
  ]);
  const complaints = await db
    .from("hostel_complaints")
    .select("id,category,details,status,created_at,hostels(name)")
    .in("status", ["open", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(8);
  return (
    <>
      <Head
        icon={<Home size={22} />}
        title="Hostel office"
        subtitle="Occupancy and open complaints."
      />
      <Tiles
        items={[
          ["Hostels", hostels, "/hostel"],
          ["Residents", residents],
          ["Beds", beds],
          ["Open complaints", open],
        ]}
      />
      <Panel title="Recent complaints">
        <DataTable
          rows={rowsFrom(complaints.data)}
          columns={[
            { key: "hostels", label: "Hostel" },
            { key: "category", label: "Category" },
            { key: "details", label: "Detail" },
            { key: "status", label: "Status" },
            { key: "created_at", label: "Raised", render: (r) => formatDate(String(r.created_at)) },
          ]}
          empty="No open complaints."
        />
      </Panel>
    </>
  );
}

export async function PlacementDashboard() {
  const db = await createClient();
  const [drives, upcoming, apps, offers] = await Promise.all([
    count(db, "placement_drives"),
    count(db, "placement_drives", (q) => q.eq("status", "upcoming")),
    count(db, "placement_applications"),
    count(db, "placement_offers"),
  ]);
  const funnel = await db
    .from("v_placement_funnel")
    .select("id,company,role_title,package_lpa,drive_date,status,applied,offers")
    .order("drive_date", { ascending: false })
    .limit(8);
  return (
    <>
      <Head
        icon={<ClipboardList size={22} />}
        title="Placement cell"
        subtitle="Drives, applications and offers."
      />
      <Tiles
        items={[
          ["Drives", drives, "/placements"],
          ["Upcoming", upcoming],
          ["Applications", apps],
          ["Offers made", offers],
        ]}
      />
      <Panel title="Recent drives">
        <DataTable
          rows={rowsFrom(funnel.data)}
          rowHref={(r) => `/placements/${String(r.id)}`}
          columns={[
            { key: "company", label: "Company" },
            { key: "role_title", label: "Role" },
            { key: "package_lpa", label: "Package (LPA)" },
            { key: "applied", label: "Applied" },
            { key: "offers", label: "Offers" },
            { key: "status", label: "Status" },
          ]}
          empty="No drives recorded."
        />
      </Panel>
    </>
  );
}

export async function LibraryDashboard() {
  const db = await createClient();
  const [titles, onLoan, overdue, finesRows] = await Promise.all([
    count(db, "books"),
    count(db, "book_loans", (q) => q.is("returned_on", null)),
    count(db, "book_loans", (q) =>
      q.is("returned_on", null).lt("due_on", new Date().toISOString().slice(0, 10)),
    ),
    db.from("book_loans").select("fine_amount").gt("fine_amount", 0),
  ]);
  const fines = rowsFrom(finesRows.data).reduce((n, r) => n + Number(r.fine_amount), 0);
  const recent = await db
    .from("v_library_loans")
    .select("id,title,borrower,issued_on,due_on,state,fine_amount")
    .eq("state", "overdue")
    .order("due_on")
    .limit(8);
  return (
    <>
      <Head
        icon={<BookOpen size={22} />}
        title="Library"
        subtitle="Circulation and overdue books."
      />
      <Tiles
        items={[
          ["Titles", titles, "/library"],
          ["On loan", onLoan],
          ["Overdue", overdue],
          ["Fines due", formatMoney(fines)],
        ]}
      />
      <Panel title="Overdue loans">
        <DataTable
          rows={rowsFrom(recent.data)}
          columns={[
            { key: "title", label: "Book" },
            { key: "borrower", label: "Borrower" },
            { key: "due_on", label: "Due", render: (r) => formatDate(String(r.due_on)) },
            {
              key: "fine_amount",
              label: "Fine",
              render: (r) => formatMoney(r.fine_amount as number),
            },
          ]}
          empty="Nothing overdue."
        />
      </Panel>
    </>
  );
}

export async function TransportDashboard() {
  const db = await createClient();
  const [routes, buses, stops, passes] = await Promise.all([
    count(db, "bus_routes"),
    count(db, "buses"),
    count(db, "bus_stops"),
    count(db, "bus_passes", (q) => q.gte("valid_to", new Date().toISOString().slice(0, 10))),
  ]);
  const fleet = await db
    .from("buses")
    .select("id,registration,capacity,driver_name,bus_routes(code,name)")
    .order("registration")
    .limit(10);
  return (
    <>
      <Head
        icon={<Bus size={22} />}
        title="Transport office"
        subtitle="Routes, fleet and passes."
      />
      <Tiles
        items={[
          ["Routes", routes, "/transport"],
          ["Buses", buses],
          ["Stops", stops],
          ["Active passes", passes],
        ]}
      />
      <Panel title="Fleet">
        <DataTable
          rows={rowsFrom(fleet.data)}
          rowHref={(r) => `/transport/${String(r.id)}`}
          columns={[
            { key: "registration", label: "Registration" },
            { key: "bus_routes", label: "Route" },
            { key: "capacity", label: "Seats" },
            { key: "driver_name", label: "Driver" },
          ]}
          empty="No buses recorded."
        />
      </Panel>
    </>
  );
}

export async function HealthDashboard() {
  const db = await createClient();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const [visits, week, lowStock] = await Promise.all([
    count(db, "medical_visits"),
    count(db, "medical_visits", (q) => q.gte("visited_at", weekAgo)),
    db.from("medicine_stock").select("id,name,quantity,reorder_at"),
  ]);
  const low = rowsFrom(lowStock.data).filter((m) => Number(m.quantity) <= Number(m.reorder_at));
  return (
    <>
      <Head
        icon={<Heart size={22} />}
        title="Health centre"
        subtitle="Visits and medicine stock."
      />
      <Tiles
        items={[
          ["Visits (total)", visits, "/health"],
          ["Visits this week", week],
          ["Medicines", rowsFrom(lowStock.data).length],
          ["Low stock", low.length],
        ]}
      />
      <Panel title="Medicines to reorder">
        <DataTable
          rows={low}
          columns={[
            { key: "name", label: "Medicine" },
            { key: "quantity", label: "In stock" },
            { key: "reorder_at", label: "Reorder at" },
          ]}
          empty="All medicines above reorder level."
        />
      </Panel>
    </>
  );
}

export async function SecurityDashboard() {
  const db = await createClient();
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const [onsite, today] = await Promise.all([
    count(db, "visitors", (q) => q.is("checked_out_at", null)),
    count(db, "visitors", (q) => q.gte("checked_in_at", dayAgo)),
  ]);
  const current = await db
    .from("visitors")
    .select("id,full_name,purpose,checked_in_at,profiles(full_name)")
    .is("checked_out_at", null)
    .order("checked_in_at", { ascending: false })
    .limit(10);
  return (
    <>
      <Head
        icon={<ShieldCheck size={22} />}
        title="Gate security"
        subtitle="Visitors on campus right now."
      />
      <Tiles
        items={[
          ["On campus now", onsite, "/visitors"],
          ["Checked in (24h)", today],
        ]}
      />
      <Panel title="Currently on campus">
        <DataTable
          rows={rowsFrom(current.data)}
          rowHref={(r) => `/visitors/${String(r.id)}`}
          columns={[
            { key: "full_name", label: "Visitor" },
            { key: "purpose", label: "Purpose" },
            { key: "profiles", label: "Host" },
            {
              key: "checked_in_at",
              label: "Since",
              render: (r) => formatTime(String(r.checked_in_at)),
            },
          ]}
          empty="No visitors on campus."
        />
      </Panel>
    </>
  );
}

export async function FinanceDashboard() {
  const db = await createClient();
  const ledger = await db.from("v_invoice_ledger").select("amount,paid,status");
  const rows = rowsFrom(ledger.data);
  const invoiced = rows.reduce((n, r) => n + Number(r.amount), 0);
  const collected = rows.reduce((n, r) => n + Number(r.paid), 0);
  const unpaid = rows.filter((r) => r.status !== "paid").length;
  return (
    <>
      <Head icon={<Wallet size={22} />} title="Accounts" subtitle="Fee collection this term." />
      <Tiles
        items={[
          ["Invoiced", formatMoney(invoiced), "/finance"],
          ["Collected", formatMoney(collected)],
          ["Outstanding", formatMoney(invoiced - collected)],
          ["Unpaid invoices", unpaid],
        ]}
      />
    </>
  );
}

export async function AlumniDashboard({ name }: { name: string }) {
  const db = await createClient();
  const events = await db
    .from("events")
    .select("id,title,starts_at,description")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at")
    .limit(6);
  return (
    <>
      <Head
        icon={<GraduationCap size={22} />}
        title={`Welcome, ${name.split(" ")[0]}`}
        subtitle="Stay connected with campus."
      />
      <Panel title="Upcoming events">
        <DataTable
          rows={rowsFrom(events.data)}
          rowHref={(r) => `/events/${String(r.id)}`}
          columns={[
            { key: "title", label: "Event" },
            { key: "starts_at", label: "When", render: (r) => formatDate(String(r.starts_at)) },
          ]}
          empty="No upcoming events."
        />
      </Panel>
    </>
  );
}
