import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { Badge, DataTable } from "@/components/ui";
import { SectionHeader } from "@/components/section";
import {
  formatDate,
  formatLabel,
  formatMoney,
  formatStatus,
  formatTime,
  formatWeekday,
  isUuid,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/data";
import { canWrite, WRITABLE } from "@/lib/permissions";
import { CheckOutVisitor, EditDelete } from "@/components/record-actions";
import { rowsFrom, type Row } from "@/types/db";

const labels: Record<string, string> = {
  courses: "Courses",
  examinations: "Examinations",
  hostel: "Hostel",
  library: "Library",
  transport: "Transport",
  events: "Events",
  clubs: "Clubs",
  sports: "Sports",
  health: "Health Centre",
  visitors: "Visitors",
  admissions: "Admissions",
  research: "Research",
  alumni: "Alumni",
  finance: "Finance",
  inventory: "Inventory",
  feedback: "Feedback",
  attendance: "Attendance",
  faculty: "Faculty",
  placements: "Placements",
  timetable: "Timetable",
  grievances: "Grievances",
};

const mainSelects: Record<string, { table: string; select: string }> = {
  faculty: {
    table: "faculty",
    select:
      "id,employee_no,full_name,email,department_id,designation,max_weekly_hours,joined_on,is_active,departments!faculty_department_id_fkey(code,name)",
  },
  placements: {
    table: "placement_drives",
    select:
      "id,company_id,role_title,package_lpa,min_cgpa,required_skills,drive_date,status,companies(name,sector)",
  },
  timetable: {
    table: "timetable_slots",
    select:
      "id,section_id,room_id,weekday,starts_at,ends_at,course_sections(section,courses(code,title)),rooms(code)",
  },
  courses: {
    table: "course_sections",
    select:
      "id,section,capacity,course_id,term_id,faculty_id,courses(code,title,credits,semester),academic_terms(name)",
  },
  examinations: {
    table: "exams",
    select:
      "id,section_id,kind,max_marks,weightage,held_on,room_id,course_sections(id,section,courses(code,title))",
  },
  hostel: { table: "hostels", select: "id,name,gender,capacity,warden_id,profiles(full_name)" },
  library: {
    table: "books",
    select: "id,isbn,title,authors,publisher,year,subjects",
  },
  transport: {
    table: "buses",
    select: "id,registration,capacity,driver_name,driver_phone,route_id,bus_routes(code,name)",
  },
  events: {
    table: "events",
    select:
      "id,title,description,organiser_club_id,room_id,starts_at,ends_at,capacity,clubs(name),rooms(code)",
  },
  clubs: {
    table: "clubs",
    select: "id,name,category,faculty_advisor,description,faculty(full_name)",
  },
  sports: { table: "sports_facilities", select: "id,name,sport,capacity" },
  health: { table: "medicine_stock", select: "id,name,quantity,reorder_at,expires_on" },
  visitors: {
    table: "visitors",
    select:
      "id,full_name,phone,id_proof,purpose,host_id,checked_in_at,checked_out_at,profiles!visitors_host_id_fkey(full_name)",
  },
  admissions: {
    table: "applicants",
    select:
      "id,full_name,email,phone,program_id,entrance_score,board_percentage,category,status,applied_at,student_id,programs(code,name)",
  },
  research: {
    table: "research_projects",
    select:
      "id,title,lead_faculty_id,funding_agency,grant_amount,starts_on,ends_on,status,faculty(full_name)",
  },
  alumni: {
    table: "alumni",
    select:
      "id,student_id,profile_id,full_name,graduation_year,program_id,current_company,job_title,city,open_to_mentor,programs(code,name)",
  },
  finance: {
    table: "invoices",
    select:
      "id,student_id,term_id,amount,due_on,status,created_at,students(id,roll_no,full_name),academic_terms(name)",
  },
  inventory: {
    table: "inventory_items",
    select: "id,sku,name,category,unit,quantity,reorder_at,room_id,rooms(code)",
  },
  grievances: {
    table: "grievances",
    select:
      "id,raised_by,category,subject,details,is_anonymous,status,assigned_to,created_at,resolved_at,profiles!grievances_raised_by_fkey(full_name)",
  },
  feedback: {
    table: "feedback_forms",
    select: "id,title,section_id,questions,opens_at,closes_at",
  },
  attendance: {
    table: "v_student_directory",
    select: "id,roll_no,full_name,department,current_semester,attendance_pct,risk_level,status",
  },
};

function isIdKey(key: string) {
  return key === "id" || key.endsWith("_id") || key === "student_id" || key === "faculty_id";
}

function formatValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (key.endsWith("_on") || key.endsWith("_at") || key === "created_at")
    return key.endsWith("_at") ? formatDate(String(value)) : formatDate(String(value));
  if (key.includes("amount") || key.includes("grant") || key.includes("package"))
    return formatMoney(value as number | string);
  if (key === "status" || key === "category" || key === "kind" || key === "stage")
    return formatStatus(value);
  if (key === "weekday") return formatWeekday(value);
  return formatLabel(value);
}

function displayFields(row: Row) {
  return Object.entries(row).filter(
    ([key, value]) => !isIdKey(key) && value !== undefined && !isUuid(value),
  );
}

function studentLink(row: Row) {
  return row.id ? (
    <Link className="text-indigo-600 hover:underline" href={`/students/${String(row.id)}`}>
      {String(row.full_name ?? row.roll_no ?? "Student")}
    </Link>
  ) : (
    "—"
  );
}

function studentName(row: Row) {
  return row.id ? String(row.full_name ?? row.roll_no) : "Hidden (another student)";
}

function recordTitle(module: string, row: Row) {
  switch (module) {
    case "courses":
    case "examinations":
    case "timetable":
      return [formatLabel(row.courses ?? row.course_sections), row.kind && formatStatus(row.kind)]
        .filter(Boolean)
        .join(" · ");
    case "library":
      return formatLabel(row.book_copies);
    case "finance":
      return `Invoice · ${formatLabel(row.students)}`;
    case "placements":
      return `${formatLabel(row.companies)} · ${String(row.role_title)}`;
    default:
      return formatLabel(
        row.full_name ?? row.title ?? row.name ?? row.registration ?? row.subject ?? row.sku,
      );
  }
}

function Related({
  title,
  rows,
  columns,
  href,
}: {
  title: string;
  rows: Row[];
  columns: { key: string; label: string; render?: (row: Row) => React.ReactNode }[];
  href?: (row: Row) => string | undefined;
}) {
  return (
    <section className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
      <h2 className="font-medium">{title}</h2>
      <div className="mt-3">
        <DataTable rows={rows} columns={columns} rowHref={href} />
      </div>
    </section>
  );
}

export async function ModuleDetail({ module, id }: { module: string; id: string }) {
  const config = mainSelects[module];
  if (!config || !labels[module]) notFound();
  const supabase = await createClient();
  const { data } = await supabase
    .from(config.table)
    .select(config.select)
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const row = data as unknown as Row;
  const related: React.ReactNode[] = [];

  if (module === "courses") {
    const [enrollments, slots, exams] = await Promise.all([
      supabase
        .from("enrollments")
        .select("id,students(id,roll_no,full_name,status)")
        .eq("section_id", id),
      supabase
        .from("timetable_slots")
        .select("id,weekday,starts_at,ends_at,rooms(code)")
        .eq("section_id", id),
      supabase.from("exams").select("id,kind,max_marks,weightage,held_on").eq("section_id", id),
    ]);
    related.push(
      <Related
        key="students"
        title="Enrolled students"
        rows={rowsFrom(enrollments.data).map((r) => (r.students ?? {}) as Row)}
        columns={[
          { key: "full_name", label: "Student", render: studentName },
          { key: "roll_no", label: "Roll no." },
          { key: "status", label: "Status" },
        ]}
        href={(r) => (r.id ? `/students/${String(r.id)}` : undefined)}
      />,
      <Related
        key="slots"
        title="Timetable slots"
        rows={rowsFrom(slots.data)}
        columns={[
          { key: "weekday", label: "Day", render: (r) => formatWeekday(r.weekday) },
          { key: "starts_at", label: "Starts", render: (r) => formatTime(String(r.starts_at)) },
          { key: "ends_at", label: "Ends", render: (r) => formatTime(String(r.ends_at)) },
          { key: "rooms", label: "Room" },
        ]}
        href={(r) => `/timetable/${String(r.id)}`}
      />,
      <Related
        key="exams"
        title="Exams"
        rows={rowsFrom(exams.data)}
        columns={[
          { key: "kind", label: "Kind" },
          { key: "max_marks", label: "Max marks" },
          { key: "weightage", label: "Weightage" },
          { key: "held_on", label: "Held on", render: (r) => formatDate(String(r.held_on)) },
        ]}
        href={(r) => `/examinations/${String(r.id)}`}
      />,
    );
  } else if (module === "faculty") {
    const [sections, mentees, workload] = await Promise.all([
      supabase
        .from("course_sections")
        .select("id,section,courses(code,title)")
        .eq("faculty_id", id),
      supabase.from("students").select("id,roll_no,full_name,status").eq("mentor_id", id),
      supabase
        .from("v_faculty_workload")
        .select("weekly_hours,max_weekly_hours")
        .eq("faculty_id", id)
        .maybeSingle(),
    ]);
    related.push(
      <Related
        key="sections"
        title="Sections taught"
        rows={rowsFrom(sections.data)}
        columns={[
          { key: "courses", label: "Course" },
          { key: "section", label: "Section" },
        ]}
        href={(r) => `/courses/${String(r.id)}`}
      />,
      <Related
        key="hours"
        title="Weekly hours"
        rows={workload.data ? [workload.data as Row] : []}
        columns={[
          { key: "weekly_hours", label: "Current hours" },
          { key: "max_weekly_hours", label: "Capacity" },
        ]}
      />,
      <Related
        key="mentees"
        title="Mentees"
        rows={rowsFrom(mentees.data)}
        columns={[
          { key: "full_name", label: "Student", render: studentName },
          { key: "roll_no", label: "Roll no." },
        ]}
        href={(r) => (r.id ? `/students/${String(r.id)}` : undefined)}
      />,
    );
  } else if (module === "hostel") {
    const { data: rooms } = await supabase
      .from("hostel_rooms")
      .select("id,room_no,beds,hostel_allocations(id,students(id,roll_no,full_name))")
      .eq("hostel_id", id);
    related.push(
      <Related
        key="rooms"
        title="Rooms and occupants"
        rows={rowsFrom(rooms).map((r) => ({
          ...r,
          occupants: rowsFrom(r.hostel_allocations).map((a) => a.students),
        }))}
        columns={[
          { key: "room_no", label: "Room" },
          { key: "beds", label: "Beds" },
          {
            key: "occupants",
            label: "Occupants",
            render: (r) =>
              rowsFrom(r.occupants)
                .map((student) => studentLink(student))
                .reduce(
                  (acc, item, index) => (
                    <>
                      {acc}
                      {index ? ", " : ""}
                      {item}
                    </>
                  ),
                  <></>,
                ),
          },
        ]}
      />,
    );
  } else if (module === "library") {
    const { data: copies } = await supabase
      .from("book_copies")
      .select("id,barcode,shelf,condition,book_loans(returned_on)")
      .eq("book_id", id);
    related.push(
      <Related
        key="copies"
        title="Copies"
        rows={rowsFrom(copies).map((c) => ({
          ...c,
          state: rowsFrom(c.book_loans).some((l) => l.returned_on === null)
            ? "on loan"
            : "available",
        }))}
        columns={[
          { key: "barcode", label: "Barcode" },
          { key: "shelf", label: "Shelf" },
          { key: "condition", label: "Condition" },
          { key: "state", label: "Status" },
        ]}
      />,
    );
  } else if (module === "transport") {
    const { data: stops } = await supabase
      .from("bus_stops")
      .select("id,name,seq,pickup_at")
      .eq("route_id", row.route_id)
      .order("seq");
    related.push(
      <Related
        key="stops"
        title="Route stops"
        rows={rowsFrom(stops)}
        columns={[
          { key: "seq", label: "Stop" },
          { key: "name", label: "Name" },
          { key: "pickup_at", label: "Pickup", render: (r) => formatTime(String(r.pickup_at)) },
        ]}
      />,
    );
  } else if (module === "events") {
    const { count } = await supabase
      .from("event_registrations")
      .select("event_id", { count: "estimated", head: true })
      .eq("event_id", id);
    related.push(
      <Related
        key="registrations"
        title="Registrations"
        rows={[{ registrations: count ?? 0, organiser: row.clubs }]}
        columns={[
          { key: "registrations", label: "Registered" },
          { key: "organiser", label: "Organiser club" },
        ]}
      />,
    );
  } else if (module === "clubs") {
    const { data: members } = await supabase
      .from("club_members")
      .select("position,joined_on,students(id,roll_no,full_name)")
      .eq("club_id", id);
    related.push(
      <Related
        key="members"
        title="Members"
        rows={rowsFrom(members).map((r) => ({
          ...(r.students as Row),
          position: r.position,
          joined_on: r.joined_on,
        }))}
        columns={[
          { key: "full_name", label: "Student", render: studentName },
          { key: "roll_no", label: "Roll no." },
          { key: "position", label: "Position" },
        ]}
        href={(r) => (r.id ? `/students/${String(r.id)}` : undefined)}
      />,
    );
  } else if (module === "placements") {
    const { data: applications } = await supabase
      .from("placement_applications")
      .select(
        "id,stage,students(id,roll_no,full_name),placement_offers(package_lpa,offered_on,accepted)",
      )
      .eq("drive_id", id);
    related.push(
      <Related
        key="applications"
        title="Applications and offers"
        rows={rowsFrom(applications).map((r) => ({
          ...((r.students as Row) ?? {}),
          stage: r.stage,
          offer: r.placement_offers,
        }))}
        columns={[
          { key: "full_name", label: "Student", render: studentName },
          { key: "roll_no", label: "Roll no." },
          {
            key: "stage",
            label: "Stage",
            render: (r) => (
              <Badge tone={r.stage === "offered" ? "good" : "neutral"}>
                {formatStatus(r.stage)}
              </Badge>
            ),
          },
          { key: "offer", label: "Offer" },
        ]}
        href={(r) => (r.id ? `/students/${String(r.id)}` : undefined)}
      />,
    );
  } else if (module === "finance") {
    const [payments, scholarships] = await Promise.all([
      supabase.from("payments").select("id,amount,method,reference,paid_at").eq("invoice_id", id),
      supabase
        .from("scholarships")
        .select("id,name,amount,term_id")
        .eq("student_id", row.student_id),
    ]);
    related.push(
      <Related
        key="payments"
        title="Payments"
        rows={rowsFrom(payments.data)}
        columns={[
          { key: "amount", label: "Amount", render: (r) => formatMoney(r.amount as number) },
          { key: "method", label: "Method" },
          { key: "paid_at", label: "Paid on", render: (r) => formatDate(String(r.paid_at)) },
        ]}
      />,
      <Related
        key="scholarships"
        title="Scholarships"
        rows={rowsFrom(scholarships.data)}
        columns={[
          { key: "name", label: "Scholarship" },
          { key: "amount", label: "Amount", render: (r) => formatMoney(r.amount as number) },
        ]}
      />,
    );
  } else if (module === "grievances") {
    const { data: updates } = await supabase
      .from("grievance_updates")
      .select("id,note,created_at,profiles(full_name)")
      .eq("grievance_id", id)
      .order("created_at");
    related.push(
      <Related
        key="timeline"
        title="Update timeline"
        rows={rowsFrom(updates)}
        columns={[
          { key: "created_at", label: "When", render: (r) => formatDate(String(r.created_at)) },
          { key: "profiles", label: "Author" },
          { key: "note", label: "Update" },
        ]}
      />,
    );
  } else if (module === "research") {
    const { data: publications } = await supabase
      .from("publications")
      .select("id,title,venue,kind,year,doi")
      .eq("project_id", id);
    related.push(
      <Related
        key="publications"
        title="Publications"
        rows={rowsFrom(publications)}
        columns={[
          { key: "title", label: "Title" },
          { key: "venue", label: "Venue" },
          { key: "year", label: "Year" },
        ]}
      />,
    );
  } else if (module === "inventory") {
    const { data: movements } = await supabase
      .from("inventory_movements")
      .select("id,delta,reason,moved_at")
      .eq("item_id", id)
      .order("moved_at", { ascending: false });
    related.push(
      <Related
        key="movements"
        title="Movements"
        rows={rowsFrom(movements)}
        columns={[
          { key: "delta", label: "Change" },
          { key: "reason", label: "Reason" },
          { key: "moved_at", label: "Moved", render: (r) => formatDate(String(r.moved_at)) },
        ]}
      />,
    );
  } else if (module === "feedback") {
    const { data: responses } = await supabase
      .from("feedback_responses")
      .select("answers")
      .eq("form_id", id);
    const answers = rowsFrom(responses).flatMap((response) =>
      response.answers && typeof response.answers === "object"
        ? Object.entries(response.answers as Row)
        : [],
    );
    const ratings = answers
      .map(([, value]) => Number(value))
      .filter((value) => Number.isFinite(value));
    related.push(
      <Related
        key="responses"
        title="Response summary"
        rows={[
          {
            count: responses?.length ?? 0,
            average: ratings.length
              ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length
              : 0,
          },
        ]}
        columns={[
          { key: "count", label: "Responses" },
          { key: "average", label: "Average rating", render: (r) => Number(r.average).toFixed(1) },
        ]}
      />,
    );
  }

  const title = recordTitle(module, row);
  const profile = await getProfile();
  const mayWrite = canWrite(profile?.role, module);
  const mayCheckOut =
    module === "visitors" &&
    !row.checked_out_at &&
    (profile?.role === "admin" || profile?.role === "security");
  return (
    <>
      <div className="mb-2 text-sm text-[var(--muted)]">
        <Link className="hover:text-[var(--ink)]" href={`/${module}`}>
          {labels[module]}
        </Link>{" "}
        / <span>{title}</span>
      </div>
      <SectionHeader
        icon={<FileText size={22} />}
        title={title}
        subtitle={labels[module]}
        action={
          <div className="flex items-center gap-3">
            {row.status ? (
              <Badge
                tone={
                  row.status === "active" || row.status === "paid" || row.status === "returned"
                    ? "good"
                    : "neutral"
                }
              >
                {formatStatus(row.status)}
              </Badge>
            ) : null}
            {mayCheckOut && <CheckOutVisitor id={id} />}
            {mayWrite && <EditDelete module={module} id={id} label={WRITABLE[module].label} />}
          </div>
        }
      />
      <dl className="grid gap-x-6 gap-y-4 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
        {displayFields(row).map(([key, value]) => (
          <div key={key}>
            <dt className="text-xs text-[var(--muted)]">{formatStatus(key)}</dt>
            <dd className="mt-1 text-sm">{formatValue(key, value)}</dd>
          </div>
        ))}
      </dl>
      {module === "finance" && row.students ? (
        <p className="mt-4 text-sm">Student: {studentLink(row.students as Row)}</p>
      ) : null}
      {related}
    </>
  );
}
