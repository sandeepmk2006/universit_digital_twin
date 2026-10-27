// Every institution section as a set of tabs, EduServe style: a context header with
// sub-tabs, optional KPI boxes, then a searchable, paginated table per tab.

import { notFound } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Bus,
  CalendarDays,
  ClipboardCheck,
  Dumbbell,
  FlaskConical,
  Folder,
  GraduationCap,
  Heart,
  Home,
  Package,
  ScanLine,
  ShieldAlert,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { Badge, DataTable, Pagination, SearchBox } from "@/components/ui";
import { SectionHeader, StatBox, StatRow } from "@/components/section";
import { AddButton } from "@/components/record-actions";
import {
  formatDate,
  formatLabel,
  formatMoney,
  formatPercent,
  formatStatus,
  formatTime,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getProfile, requireModule } from "@/lib/data";
import { canWrite, WRITABLE } from "@/lib/permissions";
import { rowsFrom, type Row } from "@/types/db";

type Format = "date" | "time" | "money" | "status" | "percent";
type Col = { key: string; label: string; format?: Format };
type Tab = {
  key: string;
  label: string;
  table: string;
  select: string;
  columns: Col[];
  search?: string;
  filter?: (q: any) => any; // eslint-disable-line
  order?: [string, boolean];
  href?: (row: Row) => string | undefined;
};
type Stat = [label: string, value: ReactNode, tone?: "indigo" | "green" | "amber" | "rose"];
type ModuleDef = {
  title: string;
  icon: ReactNode;
  tabs: Tab[];
  stats?: () => Promise<Stat[]>;
};

const today = () => new Date().toISOString().slice(0, 10);
const studentHref =
  (path = "students") =>
  (r: Row) => {
    const v = path
      .split(".")
      .reduce<unknown>((o, k) => (Array.isArray(o) ? o[0] : o)?.[k as never], r);
    return v ? `/students/${String(v)}` : undefined;
  };

async function countOf(table: string, build?: (q: any) => any) {
  // eslint-disable-line
  const db = await createClient();
  let q: any = db.from(table).select("*", { count: "exact", head: true }); // eslint-disable-line
  if (build) q = build(q);
  const { count } = await q;
  return count ?? 0;
}

export const MODULES: Record<string, ModuleDef> = {
  courses: {
    title: "Courses",
    icon: <BookOpen size={22} />,
    tabs: [
      {
        key: "current",
        label: "Current sections",
        table: "v_section_catalogue",
        select: "id,code,title,section,semester,faculty,enrolled,capacity",
        search: "title",
        filter: (q) => q.eq("is_current", true),
        order: ["code", true],
        columns: [
          { key: "code", label: "Code" },
          { key: "title", label: "Title" },
          { key: "section", label: "Section" },
          { key: "semester", label: "Sem." },
          { key: "faculty", label: "Faculty" },
          { key: "enrolled", label: "Enrolled" },
        ],
        href: (r) => `/courses/${String(r.id)}`,
      },
      {
        key: "electives",
        label: "Electives",
        table: "v_section_catalogue",
        select: "id,code,title,department,semester,faculty,enrolled",
        search: "title",
        filter: (q) => q.eq("is_current", true).eq("is_elective", true),
        order: ["code", true],
        columns: [
          { key: "code", label: "Code" },
          { key: "title", label: "Title" },
          { key: "department", label: "Dept." },
          { key: "semester", label: "Sem." },
          { key: "faculty", label: "Faculty" },
          { key: "enrolled", label: "Enrolled" },
        ],
        href: (r) => `/courses/${String(r.id)}`,
      },
      {
        key: "catalogue",
        label: "Course catalogue",
        table: "courses",
        select: "id,code,title,credits,semester,is_elective,requires_lab,departments(code)",
        search: "title",
        order: ["code", true],
        columns: [
          { key: "code", label: "Code" },
          { key: "title", label: "Title" },
          { key: "departments", label: "Dept." },
          { key: "semester", label: "Sem." },
          { key: "credits", label: "Credits" },
          { key: "is_elective", label: "Elective" },
        ],
      },
    ],
  },
  examinations: {
    title: "Examinations",
    icon: <ScanLine size={22} />,
    tabs: [
      {
        key: "held",
        label: "Assessments held",
        table: "exams",
        select: "id,kind,max_marks,weightage,held_on,course_sections(section,courses(code,title))",
        search: "kind",
        filter: (q) => q.not("held_on", "is", null),
        order: ["held_on", false],
        columns: [
          { key: "held_on", label: "Date", format: "date" },
          { key: "kind", label: "Assessment", format: "status" },
          { key: "course_sections", label: "Course" },
          { key: "max_marks", label: "Max marks" },
          { key: "weightage", label: "Weight %" },
        ],
        href: (r) => `/examinations/${String(r.id)}`,
      },
      {
        key: "pending",
        label: "Yet to be held",
        table: "exams",
        select: "id,kind,max_marks,weightage,course_sections(section,courses(code,title))",
        search: "kind",
        filter: (q) => q.is("held_on", null),
        columns: [
          { key: "kind", label: "Assessment", format: "status" },
          { key: "course_sections", label: "Course" },
          { key: "max_marks", label: "Max marks" },
          { key: "weightage", label: "Weight %" },
        ],
        href: (r) => `/examinations/${String(r.id)}`,
      },
    ],
  },
  attendance: {
    title: "Attendance",
    icon: <ClipboardCheck size={22} />,
    stats: async () => [
      [
        "Below 75%",
        await countOf("v_student_directory", (q) => q.lt("attendance_pct", 75)),
        "rose",
      ],
      [
        "Leave requests pending",
        await countOf("leave_requests", (q) => q.eq("status", "pending")),
        "amber",
      ],
    ],
    tabs: [
      {
        key: "shortage",
        label: "Attendance shortage",
        table: "v_student_directory",
        select: "id,roll_no,full_name,department,current_semester,attendance_pct,risk_level",
        search: "full_name",
        filter: (q) => q.lt("attendance_pct", 75),
        order: ["attendance_pct", true],
        columns: [
          { key: "roll_no", label: "Reg. no." },
          { key: "full_name", label: "Student" },
          { key: "department", label: "Dept." },
          { key: "current_semester", label: "Sem." },
          { key: "attendance_pct", label: "Attendance", format: "percent" },
        ],
        href: (r) => `/students/${String(r.id)}`,
      },
      {
        key: "all",
        label: "All students",
        table: "v_student_directory",
        select: "id,roll_no,full_name,department,current_semester,attendance_pct",
        search: "full_name",
        order: ["attendance_pct", true],
        columns: [
          { key: "roll_no", label: "Reg. no." },
          { key: "full_name", label: "Student" },
          { key: "department", label: "Dept." },
          { key: "current_semester", label: "Sem." },
          { key: "attendance_pct", label: "Attendance", format: "percent" },
        ],
        href: (r) => `/students/${String(r.id)}`,
      },
      {
        key: "leave",
        label: "Leave requests",
        table: "leave_requests",
        select:
          "id,leave_type,subject,from_date,to_date,status,student_id,students(full_name,roll_no)",
        search: "subject",
        order: ["created_at", false],
        columns: [
          { key: "students", label: "Student" },
          { key: "leave_type", label: "Type", format: "status" },
          { key: "subject", label: "Subject" },
          { key: "from_date", label: "From", format: "date" },
          { key: "to_date", label: "To", format: "date" },
          { key: "status", label: "Status", format: "status" },
        ],
        href: (r) => `/students/${String(r.student_id)}`,
      },
    ],
  },
  hostel: {
    title: "Hostel",
    icon: <Home size={22} />,
    stats: async () => [
      ["Hostels", await countOf("hostels")],
      ["Residents", await countOf("hostel_allocations", (q) => q.is("to_date", null)), "green"],
      [
        "Open complaints",
        await countOf("hostel_complaints", (q) => q.in("status", ["open", "in_progress"])),
        "amber",
      ],
    ],
    tabs: [
      {
        key: "hostels",
        label: "Hostels",
        table: "hostels",
        select: "id,name,gender,capacity",
        search: "name",
        order: ["name", true],
        columns: [
          { key: "name", label: "Hostel" },
          { key: "gender", label: "For" },
          { key: "capacity", label: "Capacity" },
        ],
        href: (r) => `/hostel/${String(r.id)}`,
      },
      {
        key: "residents",
        label: "Residents",
        table: "hostel_allocations",
        select:
          "id,from_date,student_id,students(full_name,roll_no),hostel_rooms(room_no,hostels(name))",
        filter: (q) => q.is("to_date", null),
        order: ["from_date", false],
        columns: [
          { key: "students", label: "Student" },
          { key: "students.roll_no", label: "Reg. no." },
          { key: "hostel_rooms.hostels", label: "Hostel" },
          { key: "hostel_rooms.room_no", label: "Room" },
          { key: "from_date", label: "Since", format: "date" },
        ],
        href: (r) => `/students/${String(r.student_id)}`,
      },
      {
        key: "complaints",
        label: "Complaints",
        table: "hostel_complaints",
        select: "id,category,details,status,created_at,hostels(name),students(full_name)",
        search: "details",
        order: ["created_at", false],
        columns: [
          { key: "created_at", label: "Raised", format: "date" },
          { key: "hostels", label: "Hostel" },
          { key: "students", label: "Student" },
          { key: "category", label: "Category", format: "status" },
          { key: "details", label: "Detail" },
          { key: "status", label: "Status", format: "status" },
        ],
      },
    ],
  },
  library: {
    title: "Library",
    icon: <BookOpen size={22} />,
    stats: async () => [
      ["Titles", await countOf("books")],
      ["On loan", await countOf("book_loans", (q) => q.is("returned_on", null)), "green"],
      [
        "Overdue",
        await countOf("book_loans", (q) => q.is("returned_on", null).lt("due_on", today())),
        "rose",
      ],
    ],
    tabs: [
      {
        key: "catalogue",
        label: "Catalogue",
        table: "books",
        select: "id,title,authors,publisher,year,isbn",
        search: "title",
        order: ["title", true],
        columns: [
          { key: "title", label: "Title" },
          { key: "authors", label: "Authors" },
          { key: "publisher", label: "Publisher" },
          { key: "year", label: "Year" },
          { key: "isbn", label: "ISBN" },
        ],
        href: (r) => `/library/${String(r.id)}`,
      },
      {
        key: "loans",
        label: "Books on loan",
        table: "v_library_loans",
        select: "id,title,barcode,borrower,issued_on,due_on,state",
        search: "title",
        filter: (q) => q.eq("state", "issued"),
        order: ["due_on", true],
        columns: [
          { key: "title", label: "Book" },
          { key: "barcode", label: "Copy" },
          { key: "borrower", label: "Borrower" },
          { key: "issued_on", label: "Issued", format: "date" },
          { key: "due_on", label: "Due", format: "date" },
        ],
      },
      {
        key: "overdue",
        label: "Overdue",
        table: "v_library_loans",
        select: "id,title,barcode,borrower,due_on,fine_amount",
        search: "title",
        filter: (q) => q.eq("state", "overdue"),
        order: ["due_on", true],
        columns: [
          { key: "title", label: "Book" },
          { key: "borrower", label: "Borrower" },
          { key: "due_on", label: "Due", format: "date" },
          { key: "fine_amount", label: "Fine", format: "money" },
        ],
      },
      {
        key: "history",
        label: "Returned",
        table: "v_library_loans",
        select: "id,title,borrower,issued_on,returned_on,fine_amount",
        search: "title",
        filter: (q) => q.eq("state", "returned"),
        order: ["returned_on", false],
        columns: [
          { key: "title", label: "Book" },
          { key: "borrower", label: "Borrower" },
          { key: "issued_on", label: "Issued", format: "date" },
          { key: "returned_on", label: "Returned", format: "date" },
          { key: "fine_amount", label: "Fine", format: "money" },
        ],
      },
    ],
  },
  transport: {
    title: "Transport",
    icon: <Bus size={22} />,
    stats: async () => [
      ["Routes", await countOf("bus_routes")],
      ["Buses", await countOf("buses")],
      ["Active passes", await countOf("bus_passes", (q) => q.gte("valid_to", today())), "green"],
    ],
    tabs: [
      {
        key: "fleet",
        label: "Fleet",
        table: "buses",
        select: "id,registration,capacity,driver_name,driver_phone,bus_routes(code,name)",
        search: "registration",
        order: ["registration", true],
        columns: [
          { key: "registration", label: "Registration" },
          { key: "bus_routes", label: "Route" },
          { key: "capacity", label: "Seats" },
          { key: "driver_name", label: "Driver" },
          { key: "driver_phone", label: "Phone" },
        ],
        href: (r) => `/transport/${String(r.id)}`,
      },
      {
        key: "stops",
        label: "Routes & stops",
        table: "bus_stops",
        select: "id,name,seq,pickup_at,bus_routes(code,name)",
        search: "name",
        order: ["route_id", true],
        columns: [
          { key: "bus_routes.code", label: "Route" },
          { key: "bus_routes.name", label: "Route name" },
          { key: "seq", label: "Stop #" },
          { key: "name", label: "Stop" },
          { key: "pickup_at", label: "Pickup", format: "time" },
        ],
      },
      {
        key: "passes",
        label: "Bus passes",
        table: "bus_passes",
        select: "id,valid_from,valid_to,profiles(full_name),bus_stops(name,bus_routes(code))",
        order: ["valid_to", false],
        columns: [
          { key: "profiles", label: "Holder" },
          { key: "bus_stops.bus_routes.code", label: "Route" },
          { key: "bus_stops", label: "Boarding stop" },
          { key: "valid_to", label: "Valid till", format: "date" },
        ],
      },
    ],
  },
  events: {
    title: "Events",
    icon: <CalendarDays size={22} />,
    tabs: [
      {
        key: "upcoming",
        label: "Upcoming",
        table: "events",
        select: "id,title,starts_at,capacity,clubs(name),rooms(code)",
        search: "title",
        filter: (q) => q.gte("starts_at", new Date().toISOString()),
        order: ["starts_at", true],
        columns: [
          { key: "title", label: "Event" },
          { key: "starts_at", label: "Date", format: "date" },
          { key: "clubs", label: "Organised by" },
          { key: "rooms", label: "Venue" },
          { key: "capacity", label: "Capacity" },
        ],
        href: (r) => `/events/${String(r.id)}`,
      },
      {
        key: "past",
        label: "Past events",
        table: "events",
        select: "id,title,starts_at,capacity,clubs(name),rooms(code)",
        search: "title",
        filter: (q) => q.lt("starts_at", new Date().toISOString()),
        order: ["starts_at", false],
        columns: [
          { key: "title", label: "Event" },
          { key: "starts_at", label: "Date", format: "date" },
          { key: "clubs", label: "Organised by" },
          { key: "rooms", label: "Venue" },
        ],
        href: (r) => `/events/${String(r.id)}`,
      },
    ],
  },
  clubs: {
    title: "Clubs",
    icon: <Users size={22} />,
    tabs: [
      {
        key: "clubs",
        label: "Clubs",
        table: "clubs",
        select: "id,name,category,description,faculty(full_name)",
        search: "name",
        order: ["name", true],
        columns: [
          { key: "name", label: "Club" },
          { key: "category", label: "Category", format: "status" },
          { key: "faculty", label: "Faculty advisor" },
          { key: "description", label: "About" },
        ],
        href: (r) => `/clubs/${String(r.id)}`,
      },
      {
        key: "members",
        label: "Members",
        table: "club_members",
        select: "student_id,position,joined_on,clubs(name),students(full_name,roll_no)",
        order: ["joined_on", false],
        columns: [
          { key: "students", label: "Student" },
          { key: "students.roll_no", label: "Reg. no." },
          { key: "clubs", label: "Club" },
          { key: "position", label: "Role", format: "status" },
          { key: "joined_on", label: "Joined", format: "date" },
        ],
        href: (r) => `/students/${String(r.student_id)}`,
      },
    ],
  },
  sports: {
    title: "Sports",
    icon: <Dumbbell size={22} />,
    tabs: [
      {
        key: "facilities",
        label: "Facilities",
        table: "sports_facilities",
        select: "id,name,sport,capacity",
        search: "name",
        order: ["name", true],
        columns: [
          { key: "name", label: "Facility" },
          { key: "sport", label: "Sport", format: "status" },
          { key: "capacity", label: "Capacity" },
        ],
        href: (r) => `/sports/${String(r.id)}`,
      },
      {
        key: "bookings",
        label: "Bookings",
        table: "facility_bookings",
        select: "id,starts_at,ends_at,sports_facilities(name),profiles(full_name)",
        order: ["starts_at", true],
        columns: [
          { key: "sports_facilities", label: "Facility" },
          { key: "profiles", label: "Booked by" },
          { key: "starts_at", label: "Date", format: "date" },
          { key: "starts_at", label: "From", format: "time" },
          { key: "ends_at", label: "To", format: "time" },
        ],
      },
      {
        key: "achievements",
        label: "Achievements",
        table: "sports_achievements",
        select: "id,student_id,sport,level,title,achieved_on,students(full_name,roll_no)",
        search: "title",
        order: ["achieved_on", false],
        columns: [
          { key: "students", label: "Student" },
          { key: "sport", label: "Sport", format: "status" },
          { key: "level", label: "Level", format: "status" },
          { key: "title", label: "Achievement" },
          { key: "achieved_on", label: "Date", format: "date" },
        ],
        href: (r) => `/students/${String(r.student_id)}`,
      },
    ],
  },
  health: {
    title: "Health Centre",
    icon: <Heart size={22} />,
    tabs: [
      {
        key: "medicines",
        label: "Medicine stock",
        table: "medicine_stock",
        select: "id,name,quantity,reorder_at,expires_on",
        search: "name",
        order: ["name", true],
        columns: [
          { key: "name", label: "Medicine" },
          { key: "quantity", label: "In stock" },
          { key: "reorder_at", label: "Reorder at" },
          { key: "expires_on", label: "Expires", format: "date" },
        ],
        href: (r) => `/health/${String(r.id)}`,
      },
      {
        key: "visits",
        label: "Patient visits",
        table: "medical_visits",
        select:
          "id,visited_at,complaint,diagnosis,prescription,profiles!medical_visits_patient_id_fkey(full_name)",
        search: "complaint",
        order: ["visited_at", false],
        columns: [
          { key: "visited_at", label: "Date", format: "date" },
          { key: "profiles", label: "Patient" },
          { key: "complaint", label: "Complaint" },
          { key: "diagnosis", label: "Diagnosis" },
        ],
      },
    ],
  },
  visitors: {
    title: "Visitors",
    icon: <UserCheck size={22} />,
    stats: async () => [
      ["On campus now", await countOf("visitors", (q) => q.is("checked_out_at", null)), "green"],
      ["Total logged", await countOf("visitors")],
    ],
    tabs: [
      {
        key: "onsite",
        label: "On campus now",
        table: "visitors",
        select: "id,full_name,purpose,checked_in_at,profiles!visitors_host_id_fkey(full_name)",
        search: "full_name",
        filter: (q) => q.is("checked_out_at", null),
        order: ["checked_in_at", false],
        columns: [
          { key: "full_name", label: "Visitor" },
          { key: "purpose", label: "Purpose" },
          { key: "profiles", label: "Host" },
          { key: "checked_in_at", label: "In since", format: "time" },
        ],
        href: (r) => `/visitors/${String(r.id)}`,
      },
      {
        key: "log",
        label: "Visitor log",
        table: "visitors",
        select:
          "id,full_name,purpose,checked_in_at,checked_out_at,profiles!visitors_host_id_fkey(full_name)",
        search: "full_name",
        order: ["checked_in_at", false],
        columns: [
          { key: "checked_in_at", label: "Date", format: "date" },
          { key: "full_name", label: "Visitor" },
          { key: "purpose", label: "Purpose" },
          { key: "profiles", label: "Host" },
          { key: "checked_in_at", label: "In", format: "time" },
          { key: "checked_out_at", label: "Out", format: "time" },
        ],
        href: (r) => `/visitors/${String(r.id)}`,
      },
    ],
  },
  admissions: {
    title: "Admissions",
    icon: <GraduationCap size={22} />,
    stats: async () => [
      ["Applications", await countOf("applicants")],
      ["Shortlisted", await countOf("applicants", (q) => q.eq("status", "shortlisted"))],
      [
        "Offers made",
        await countOf("applicants", (q) => q.in("status", ["offered", "accepted"])),
        "green",
      ],
      ["Accepted", await countOf("applicants", (q) => q.eq("status", "accepted")), "green"],
    ],
    tabs: (["all", "submitted", "shortlisted", "offered", "accepted", "rejected"] as const).map(
      (st) => ({
        key: st,
        label:
          st === "all"
            ? "All applications"
            : formatStatus(st).replace(/^\w/, (c) => c.toUpperCase()),
        table: "applicants",
        select:
          "id,full_name,email,entrance_score,board_percentage,category,status,applied_at,programs(code)",
        search: "full_name",
        filter: st === "all" ? undefined : (q) => q.eq("status", st),
        order: ["entrance_score", false] as [string, boolean],
        columns: [
          { key: "full_name", label: "Applicant" },
          { key: "programs", label: "Programme" },
          { key: "entrance_score", label: "Entrance" },
          { key: "board_percentage", label: "Board %" },
          { key: "category", label: "Category" },
          { key: "status", label: "Status", format: "status" as Format },
        ],
        href: (r: Row) => `/admissions/${String(r.id)}`,
      }),
    ),
  },
  research: {
    title: "Research",
    icon: <FlaskConical size={22} />,
    tabs: [
      {
        key: "projects",
        label: "Projects",
        table: "research_projects",
        select: "id,title,funding_agency,grant_amount,status,starts_on,faculty(full_name)",
        search: "title",
        order: ["starts_on", false],
        columns: [
          { key: "title", label: "Project" },
          { key: "faculty", label: "Lead" },
          { key: "funding_agency", label: "Agency" },
          { key: "grant_amount", label: "Grant", format: "money" },
          { key: "status", label: "Status", format: "status" },
        ],
        href: (r) => `/research/${String(r.id)}`,
      },
      {
        key: "publications",
        label: "Publications",
        table: "publications",
        select: "id,title,venue,kind,year,doi",
        search: "title",
        order: ["year", false],
        columns: [
          { key: "title", label: "Title" },
          { key: "venue", label: "Venue" },
          { key: "kind", label: "Type", format: "status" },
          { key: "year", label: "Year" },
        ],
      },
    ],
  },
  alumni: {
    title: "Alumni",
    icon: <GraduationCap size={22} />,
    tabs: [
      {
        key: "all",
        label: "Directory",
        table: "alumni",
        select: "id,full_name,graduation_year,current_company,job_title,city,programs(code)",
        search: "full_name",
        order: ["graduation_year", false],
        columns: [
          { key: "full_name", label: "Name" },
          { key: "programs", label: "Programme" },
          { key: "graduation_year", label: "Batch" },
          { key: "current_company", label: "Company" },
          { key: "job_title", label: "Role" },
          { key: "city", label: "City" },
        ],
        href: (r) => `/alumni/${String(r.id)}`,
      },
      {
        key: "mentors",
        label: "Open to mentor",
        table: "alumni",
        select: "id,full_name,graduation_year,current_company,job_title,city",
        search: "full_name",
        filter: (q) => q.eq("open_to_mentor", true),
        order: ["graduation_year", false],
        columns: [
          { key: "full_name", label: "Name" },
          { key: "graduation_year", label: "Batch" },
          { key: "current_company", label: "Company" },
          { key: "job_title", label: "Role" },
        ],
        href: (r) => `/alumni/${String(r.id)}`,
      },
    ],
  },
  finance: {
    title: "Finance",
    icon: <Wallet size={22} />,
    stats: async () => [
      ["Invoices", await countOf("invoices")],
      ["Paid", await countOf("invoices", (q) => q.eq("status", "paid")), "green"],
      [
        "Outstanding",
        await countOf("invoices", (q) => q.in("status", ["unpaid", "partial"])),
        "rose",
      ],
      ["Scholarships", await countOf("scholarships"), "amber"],
    ],
    tabs: [
      {
        key: "invoices",
        label: "Fee invoices",
        table: "v_invoice_ledger",
        select: "id,roll_no,full_name,amount,paid,scholarship,due_on,status",
        search: "full_name",
        order: ["roll_no", true],
        columns: [
          { key: "roll_no", label: "Reg. no." },
          { key: "full_name", label: "Student" },
          { key: "amount", label: "Billed", format: "money" },
          { key: "paid", label: "Paid", format: "money" },
          { key: "scholarship", label: "Scholarship", format: "money" },
          { key: "status", label: "Status", format: "status" },
        ],
        href: (r) => `/finance/${String(r.id)}`,
      },
      {
        key: "dues",
        label: "Outstanding dues",
        table: "v_invoice_ledger",
        select: "id,roll_no,full_name,amount,paid,due_on,status",
        search: "full_name",
        filter: (q) => q.in("status", ["unpaid", "partial"]),
        order: ["due_on", true],
        columns: [
          { key: "roll_no", label: "Reg. no." },
          { key: "full_name", label: "Student" },
          { key: "amount", label: "Billed", format: "money" },
          { key: "paid", label: "Paid", format: "money" },
          { key: "due_on", label: "Due", format: "date" },
          { key: "status", label: "Status", format: "status" },
        ],
        href: (r) => `/finance/${String(r.id)}`,
      },
      {
        key: "receipts",
        label: "Receipts",
        table: "payments",
        select: "id,amount,method,reference,paid_at,invoices(students(full_name,roll_no))",
        search: "reference",
        order: ["paid_at", false],
        columns: [
          { key: "paid_at", label: "Date", format: "date" },
          { key: "reference", label: "Receipt no." },
          { key: "invoices.students", label: "Student" },
          { key: "method", label: "Mode", format: "status" },
          { key: "amount", label: "Amount", format: "money" },
        ],
      },
      {
        key: "scholarships",
        label: "Scholarships",
        table: "scholarships",
        select: "id,name,amount,student_id,students(full_name,roll_no)",
        search: "name",
        columns: [
          { key: "students", label: "Student" },
          { key: "students.roll_no", label: "Reg. no." },
          { key: "name", label: "Scholarship" },
          { key: "amount", label: "Amount", format: "money" },
        ],
        href: (r) => `/students/${String(r.student_id)}`,
      },
      {
        key: "expenses",
        label: "Expenses",
        table: "expenses",
        select: "id,category,amount,spent_on,notes,departments(code)",
        search: "category",
        order: ["spent_on", false],
        columns: [
          { key: "spent_on", label: "Date", format: "date" },
          { key: "departments", label: "Dept." },
          { key: "category", label: "Category", format: "status" },
          { key: "notes", label: "Notes" },
          { key: "amount", label: "Amount", format: "money" },
        ],
      },
    ],
  },
  inventory: {
    title: "Inventory",
    icon: <Package size={22} />,
    tabs: [
      {
        key: "items",
        label: "Stock",
        table: "inventory_items",
        select: "id,sku,name,category,quantity,unit,reorder_at",
        search: "name",
        order: ["sku", true],
        columns: [
          { key: "sku", label: "SKU" },
          { key: "name", label: "Item" },
          { key: "category", label: "Category" },
          { key: "quantity", label: "Qty" },
          { key: "unit", label: "Unit" },
          { key: "reorder_at", label: "Reorder at" },
        ],
        href: (r) => `/inventory/${String(r.id)}`,
      },
      {
        key: "movements",
        label: "Stock movements",
        table: "inventory_movements",
        select: "id,delta,reason,moved_at,inventory_items(name,sku)",
        order: ["moved_at", false],
        columns: [
          { key: "moved_at", label: "Date", format: "date" },
          { key: "inventory_items", label: "Item" },
          { key: "reason", label: "Reason", format: "status" },
          { key: "delta", label: "Change" },
        ],
      },
    ],
  },
  feedback: {
    title: "Feedback",
    icon: <BarChart3 size={22} />,
    tabs: [
      {
        key: "open",
        label: "Open forms",
        table: "feedback_forms",
        select: "id,title,opens_at,closes_at",
        search: "title",
        filter: (q) => q.gte("closes_at", new Date().toISOString()),
        order: ["closes_at", true],
        columns: [
          { key: "title", label: "Form" },
          { key: "opens_at", label: "Opens", format: "date" },
          { key: "closes_at", label: "Closes", format: "date" },
        ],
        href: (r) => `/feedback/${String(r.id)}`,
      },
      {
        key: "closed",
        label: "Closed forms",
        table: "feedback_forms",
        select: "id,title,opens_at,closes_at",
        search: "title",
        filter: (q) => q.lt("closes_at", new Date().toISOString()),
        order: ["closes_at", false],
        columns: [
          { key: "title", label: "Form" },
          { key: "opens_at", label: "Opened", format: "date" },
          { key: "closes_at", label: "Closed", format: "date" },
        ],
        href: (r) => `/feedback/${String(r.id)}`,
      },
    ],
  },
  faculty: {
    title: "Faculty",
    icon: <GraduationCap size={22} />,
    tabs: [
      {
        key: "directory",
        label: "Directory",
        table: "faculty",
        select:
          "id,employee_no,full_name,designation,email,joined_on,departments!faculty_department_id_fkey(code)",
        search: "full_name",
        order: ["employee_no", true],
        columns: [
          { key: "employee_no", label: "Emp. no." },
          { key: "full_name", label: "Name" },
          { key: "departments", label: "Dept." },
          { key: "designation", label: "Designation" },
          { key: "email", label: "Email" },
        ],
        href: (r) => `/faculty/${String(r.id)}`,
      },
      {
        key: "workload",
        label: "Teaching workload",
        table: "v_faculty_workload",
        select: "faculty_id,full_name,weekly_hours,max_weekly_hours,sections",
        search: "full_name",
        order: ["weekly_hours", false],
        columns: [
          { key: "full_name", label: "Name" },
          { key: "sections", label: "Sections" },
          { key: "weekly_hours", label: "Hours / week" },
          { key: "max_weekly_hours", label: "Max" },
        ],
        href: (r) => `/faculty/${String(r.faculty_id)}`,
      },
      {
        key: "research",
        label: "Research projects",
        table: "research_projects",
        select: "id,title,funding_agency,status,faculty(full_name)",
        search: "title",
        columns: [
          { key: "faculty", label: "Lead" },
          { key: "title", label: "Project" },
          { key: "funding_agency", label: "Agency" },
          { key: "status", label: "Status", format: "status" },
        ],
        href: (r) => `/research/${String(r.id)}`,
      },
    ],
  },
  placements: {
    title: "Placements",
    icon: <BarChart3 size={22} />,
    stats: async () => [
      ["Drives", await countOf("placement_drives")],
      ["Upcoming", await countOf("placement_drives", (q) => q.eq("status", "upcoming"))],
      ["Applications", await countOf("placement_applications")],
      ["Offers", await countOf("placement_offers"), "green"],
    ],
    tabs: [
      {
        key: "drives",
        label: "Drives",
        table: "v_placement_funnel",
        select: "id,company,role_title,package_lpa,drive_date,status,applied,offers",
        search: "company",
        order: ["drive_date", false],
        columns: [
          { key: "drive_date", label: "Date", format: "date" },
          { key: "company", label: "Company" },
          { key: "role_title", label: "Role" },
          { key: "package_lpa", label: "LPA" },
          { key: "applied", label: "Applied" },
          { key: "offers", label: "Offers" },
          { key: "status", label: "Status", format: "status" },
        ],
        href: (r) => `/placements/${String(r.id)}`,
      },
      {
        key: "applications",
        label: "Applications",
        table: "placement_applications",
        select:
          "id,stage,updated_at,student_id,students(full_name,roll_no),placement_drives(role_title,companies(name))",
        order: ["updated_at", false],
        columns: [
          { key: "students", label: "Student" },
          { key: "students.roll_no", label: "Reg. no." },
          { key: "placement_drives.companies", label: "Company" },
          { key: "placement_drives.role_title", label: "Role" },
          { key: "stage", label: "Stage", format: "status" },
        ],
        href: (r) => `/students/${String(r.student_id)}`,
      },
      {
        key: "offers",
        label: "Offers",
        table: "placement_offers",
        select:
          "id,package_lpa,offered_on,accepted,placement_applications(student_id,students(full_name,roll_no),placement_drives(companies(name)))",
        order: ["package_lpa", false],
        columns: [
          { key: "placement_applications.students", label: "Student" },
          { key: "placement_applications.placement_drives.companies", label: "Company" },
          { key: "package_lpa", label: "LPA" },
          { key: "offered_on", label: "Offered", format: "date" },
          { key: "accepted", label: "Accepted" },
        ],
        href: studentHref("placement_applications.student_id"),
      },
      {
        key: "companies",
        label: "Companies",
        table: "companies",
        select: "id,name,sector,website",
        search: "name",
        order: ["name", true],
        columns: [
          { key: "name", label: "Company" },
          { key: "sector", label: "Sector" },
          { key: "website", label: "Website" },
        ],
      },
    ],
  },
  grievances: {
    title: "Grievances",
    icon: <ShieldAlert size={22} />,
    tabs: [
      {
        key: "open",
        label: "Open",
        table: "grievances",
        select: "id,category,subject,status,is_anonymous,created_at",
        search: "subject",
        filter: (q) => q.in("status", ["open", "assigned", "in_progress"]),
        order: ["created_at", false],
        columns: [
          { key: "created_at", label: "Raised", format: "date" },
          { key: "category", label: "Category", format: "status" },
          { key: "subject", label: "Subject" },
          { key: "status", label: "Status", format: "status" },
        ],
        href: (r) => `/grievances/${String(r.id)}`,
      },
      {
        key: "resolved",
        label: "Resolved",
        table: "grievances",
        select: "id,category,subject,status,created_at,resolved_at",
        search: "subject",
        filter: (q) => q.in("status", ["resolved", "closed"]),
        order: ["resolved_at", false],
        columns: [
          { key: "created_at", label: "Raised", format: "date" },
          { key: "category", label: "Category", format: "status" },
          { key: "subject", label: "Subject" },
          { key: "resolved_at", label: "Resolved", format: "date" },
        ],
        href: (r) => `/grievances/${String(r.id)}`,
      },
    ],
  },
};

// Read a dotted path through PostgREST embeds (arrays use their first element).
function pick(row: Row, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => {
    const base = Array.isArray(o) ? o[0] : o;
    return base && typeof base === "object" ? (base as Row)[k] : undefined;
  }, row);
}

function cell(row: Row, c: Col): ReactNode {
  const v = pick(row, c.key);
  switch (c.format) {
    case "date":
      return formatDate(v as string);
    case "time":
      return formatTime(v as string);
    case "money":
      return formatMoney(v as number);
    case "percent":
      return (
        <span className={Number(v) < 75 ? "font-medium text-rose-600" : ""}>
          {formatPercent(v as number)}
        </span>
      );
    case "status": {
      const s = String(v ?? "");
      const tone = [
        "active",
        "paid",
        "returned",
        "approved",
        "resolved",
        "closed",
        "offered",
        "accepted",
        "ready",
      ].includes(s)
        ? "good"
        : ["rejected", "overdue", "unpaid", "high"].includes(s)
          ? "bad"
          : ["pending", "partial", "open", "in_progress", "submitted", "shortlisted"].includes(s)
            ? "warn"
            : "neutral";
      return <Badge tone={tone}>{formatStatus(s)}</Badge>;
    }
    default:
      return formatLabel(v);
  }
}

export async function ModuleList({
  module,
  tab: tabKey,
  page: pageParam,
  q: qParam,
}: {
  module: string;
  tab?: string;
  page?: string;
  q?: string;
}) {
  const def = MODULES[module];
  if (!def) notFound();
  await requireModule(module);
  const tab = def.tabs.find((t) => t.key === tabKey) ?? def.tabs[0];
  const page = Math.max(1, Number(pageParam ?? 1));
  const q = qParam?.trim() ?? "";
  const pageSize = 15;
  const supabase = await createClient();

  let query: any = supabase // eslint-disable-line
    .from(tab.table)
    .select(tab.select, { count: "estimated" })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (tab.filter) query = tab.filter(query);
  if (q && tab.search) query = query.ilike(tab.search, `%${q}%`);
  if (tab.order) query = query.order(tab.order[0], { ascending: tab.order[1], nullsFirst: false });

  const [{ data, count, error }, stats, profile] = await Promise.all([
    query,
    def.stats ? def.stats() : Promise.resolve([] as Stat[]),
    getProfile(),
  ]);
  const isPrimary = tab.key === def.tabs[0].key;
  const mayAdd = isPrimary && canWrite(profile?.role, module);

  return (
    <>
      <SectionHeader
        icon={def.icon ?? <Folder size={22} />}
        title={def.title}
        subtitle={`${tab.label} · ${count ?? 0} record${count === 1 ? "" : "s"}`}
        action={mayAdd ? <AddButton module={module} label={WRITABLE[module].label} /> : undefined}
        tabs={def.tabs.map((t) => ({ key: t.key, label: t.label }))}
        activeTab={tab.key}
        baseHref={`/${module}`}
      />
      {stats.length > 0 && (
        <div className="mb-4">
          <StatRow>
            {stats.map(([label, value, tone]) => (
              <StatBox key={label} label={label} value={value} tone={tone} />
            ))}
          </StatRow>
        </div>
      )}
      {tab.search && (
        <form className="mb-4 flex max-w-md gap-2">
          {!isPrimary && <input type="hidden" name="tab" value={tab.key} />}
          <SearchBox placeholder={`Search ${tab.label.toLowerCase()}`} value={q} />
          <button className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white">
            Search
          </button>
        </form>
      )}
      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          This list could not be loaded: {error.message}
        </p>
      ) : (
        <DataTable
          rows={rowsFrom(data)}
          rowHref={tab.href}
          columns={tab.columns.map((c, i) => ({
            key: `${c.key}-${i}`,
            label: c.label,
            render: (r: Row) => cell(r, c),
          }))}
          empty={`No ${tab.label.toLowerCase()} to show.`}
        />
      )}
      <Pagination
        page={page}
        total={count ?? 0}
        pageSize={pageSize}
        basePath={`/${module}`}
        query={q}
        extra={isPrimary ? undefined : { tab: tab.key }}
      />
    </>
  );
}
