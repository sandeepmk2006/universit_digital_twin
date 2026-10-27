import { notFound } from "next/navigation";
import { Badge, DataTable, PageHeader, Pagination, SearchBox } from "@/components/ui";
import { formatDate, formatMoney, formatStatus, formatTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { rowsFrom, type Row } from "@/types/db";

type ModuleConfig = {
  table: string;
  title: string;
  columns: { key: string; label: string; format?: "date" | "time" | "money" | "status" }[];
  searchColumn: string;
  select?: string;
};

const config: Record<string, ModuleConfig> = {
  courses: {
    table: "v_section_catalogue",
    title: "Courses",
    searchColumn: "title",
    columns: [
      { key: "code", label: "Code" },
      { key: "title", label: "Title" },
      { key: "section", label: "Section" },
      { key: "semester", label: "Semester" },
      { key: "faculty", label: "Faculty" },
      { key: "enrolled", label: "Enrolled" },
    ],
    select: "id,code,title,section,semester,faculty,enrolled,is_current",
  },
  examinations: {
    table: "exams",
    title: "Examinations",
    searchColumn: "kind",
    select: "id,section_id,kind,max_marks,weightage,held_on,course_sections(courses(code,title))",
    columns: [
      { key: "kind", label: "Kind" },
      { key: "course_sections", label: "Course" },
      { key: "max_marks", label: "Max marks" },
      { key: "weightage", label: "Weightage" },
      { key: "held_on", label: "Held on", format: "date" },
    ],
  },
  hostel: {
    table: "hostels",
    title: "Hostel",
    searchColumn: "name",
    columns: [
      { key: "name", label: "Hostel" },
      { key: "gender", label: "Gender" },
      { key: "capacity", label: "Capacity" },
    ],
    select: "id,name,gender,capacity",
  },
  library: {
    table: "v_library_loans",
    title: "Library",
    searchColumn: "title",
    columns: [
      { key: "title", label: "Book" },
      { key: "barcode", label: "Barcode" },
      { key: "borrower", label: "Borrower" },
      { key: "due_on", label: "Due", format: "date" },
      { key: "fine_amount", label: "Fine", format: "money" },
      { key: "state", label: "Status", format: "status" },
    ],
    select: "id,title,barcode,borrower,due_on,fine_amount,state",
  },
  transport: {
    table: "buses",
    title: "Transport",
    searchColumn: "registration",
    columns: [
      { key: "registration", label: "Registration" },
      { key: "capacity", label: "Capacity" },
      { key: "driver_name", label: "Driver" },
    ],
    select: "id,registration,capacity,driver_name",
  },
  events: {
    table: "events",
    title: "Events",
    searchColumn: "title",
    columns: [
      { key: "title", label: "Event" },
      { key: "starts_at", label: "Starts", format: "date" },
      { key: "capacity", label: "Capacity" },
    ],
    select: "id,title,starts_at,capacity,organiser_club_id",
  },
  clubs: {
    table: "clubs",
    title: "Clubs",
    searchColumn: "name",
    columns: [
      { key: "name", label: "Name" },
      { key: "category", label: "Category" },
      { key: "description", label: "Description" },
    ],
    select: "id,name,category,description",
  },
  sports: {
    table: "sports_facilities",
    title: "Sports",
    searchColumn: "name",
    columns: [
      { key: "name", label: "Facility" },
      { key: "sport", label: "Sport" },
      { key: "capacity", label: "Capacity" },
    ],
    select: "id,name,sport,capacity",
  },
  health: {
    table: "medicine_stock",
    title: "Health Centre",
    searchColumn: "name",
    columns: [
      { key: "name", label: "Medicine" },
      { key: "quantity", label: "Quantity" },
      { key: "expires_on", label: "Expires", format: "date" },
    ],
    select: "id,name,quantity,expires_on",
  },
  visitors: {
    table: "visitors",
    title: "Visitors",
    searchColumn: "full_name",
    select: "id,full_name,purpose,checked_in_at,host_id,profiles(full_name)",
    columns: [
      { key: "full_name", label: "Visitor" },
      { key: "purpose", label: "Purpose" },
      { key: "checked_in_at", label: "Checked in", format: "date" },
      { key: "host_name", label: "Host" },
    ],
  },
  admissions: {
    table: "applicants",
    title: "Admissions",
    searchColumn: "full_name",
    columns: [
      { key: "full_name", label: "Applicant" },
      { key: "email", label: "Email" },
      { key: "status", label: "Status", format: "status" },
      { key: "applied_at", label: "Applied", format: "date" },
    ],
    select: "id,full_name,email,status,applied_at,program_id",
  },
  research: {
    table: "research_projects",
    title: "Research",
    searchColumn: "title",
    columns: [
      { key: "title", label: "Project" },
      { key: "funding_agency", label: "Agency" },
      { key: "status", label: "Status", format: "status" },
      { key: "starts_on", label: "Starts", format: "date" },
    ],
    select: "id,title,funding_agency,status,starts_on,ends_on,lead_faculty_id",
  },
  alumni: {
    table: "alumni",
    title: "Alumni",
    searchColumn: "full_name",
    columns: [
      { key: "full_name", label: "Name" },
      { key: "graduation_year", label: "Graduated" },
      { key: "current_company", label: "Company" },
      { key: "city", label: "City" },
    ],
    select: "id,full_name,graduation_year,current_company,city,student_id",
  },
  finance: {
    table: "v_invoice_ledger",
    title: "Finance",
    searchColumn: "full_name",
    columns: [
      { key: "roll_no", label: "Roll no." },
      { key: "full_name", label: "Student" },
      { key: "amount", label: "Amount", format: "money" },
      { key: "due_on", label: "Due", format: "date" },
      { key: "status", label: "Status", format: "status" },
    ],
    select: "id,student_id,roll_no,full_name,amount,due_on,status,paid,scholarship",
  },
  inventory: {
    table: "inventory_items",
    title: "Inventory",
    searchColumn: "name",
    columns: [
      { key: "sku", label: "SKU" },
      { key: "name", label: "Item" },
      { key: "category", label: "Category" },
      { key: "quantity", label: "Quantity" },
    ],
    select: "id,sku,name,category,quantity,unit,room_id",
  },
  feedback: {
    table: "feedback_forms",
    title: "Feedback",
    searchColumn: "title",
    columns: [
      { key: "title", label: "Form" },
      { key: "opens_at", label: "Opens", format: "date" },
      { key: "closes_at", label: "Closes", format: "date" },
    ],
    select: "id,title,opens_at,closes_at,section_id",
  },
  attendance: {
    table: "v_student_directory",
    title: "Attendance",
    searchColumn: "full_name",
    columns: [
      { key: "full_name", label: "Student" },
      { key: "department", label: "Department" },
      { key: "attendance_pct", label: "Attendance" },
      { key: "risk_level", label: "Risk", format: "status" },
    ],
    select: "id,full_name,department,attendance_pct,risk_level",
  },
};

function cellValue(row: Row, column: ModuleConfig["columns"][number]) {
  if (column.key === "host_name") {
    return String((row.profiles as { full_name?: string } | null)?.full_name ?? "—");
  }
  const value = row[column.key];
  if (column.format === "date") return formatDate(String(value ?? ""));
  if (column.format === "time") return formatTime(String(value ?? ""));
  if (column.format === "money") return formatMoney(value as number | string | null);
  if (column.format === "status")
    return (
      <Badge tone={String(value) === "active" || String(value) === "returned" ? "good" : "neutral"}>
        {formatStatus(value)}
      </Badge>
    );
  return String(value ?? "—");
}

export default async function ModulePage({
  params,
  searchParams,
}: {
  params: Promise<{ module: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { module } = await params;
  const item = config[module];
  if (!item) notFound();
  const paramsValue = await searchParams;
  const page = Math.max(1, Number(paramsValue.page ?? 1));
  const q = paramsValue.q?.trim() ?? "";
  const pageSize = 15;
  const supabase = await createClient();
  let query = supabase
    .from(item.table)
    .select(item.select ?? item.columns.map((column) => column.key).join(","), {
      count: "estimated",
    })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (q) query = query.ilike(item.searchColumn, `%${q}%`);
  if (module === "courses") query = query.eq("is_current", true);
  if (module === "attendance") query = query.order("attendance_pct", { ascending: true });
  const { data, count } = await query;
  return (
    <>
      <PageHeader
        title={item.title}
        description="Operational records from the university system."
      />
      <form className="mb-4 flex max-w-md gap-2">
        <SearchBox placeholder={`Search ${item.title.toLowerCase()}`} value={q} />
        <button className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white">
          Search
        </button>
      </form>
      <DataTable
        rows={rowsFrom(data)}
        rowHref={(row) => `/${module}/${String(row.id)}`}
        columns={item.columns.map((column) => ({
          ...column,
          render: (row: Row) => cellValue(row, column),
        }))}
        empty={`No ${item.title.toLowerCase()} records are available.`}
      />
      <Pagination
        page={page}
        total={count ?? 0}
        pageSize={pageSize}
        basePath={`/${module}`}
        query={q}
      />
    </>
  );
}
