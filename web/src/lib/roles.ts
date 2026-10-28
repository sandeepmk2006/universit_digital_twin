// Who can see what. The database enforces row-level security; this table decides
// which pages a role may open at all, so each person lands on a workspace that is
// theirs rather than the whole institution. "*" means every module.

export type Role =
  | "admin"
  | "hod"
  | "faculty"
  | "student"
  | "warden"
  | "placement_officer"
  | "librarian"
  | "transport_manager"
  | "doctor"
  | "security"
  | "accountant"
  | "alumni";

// Module = the first path segment of a page (e.g. "finance" for /finance).
export const ACCESS: Record<Role, string[] | "*"> = {
  admin: "*",
  hod: [
    "students",
    "faculty",
    "courses",
    "timetable",
    "attendance",
    "mark-attendance",
    "examinations",
    "placements",
    "research",
    "grievances",
    "feedback",
    "insights",
    "assistant",
  ],
  faculty: ["students", "courses", "timetable", "attendance", "mark-attendance", "examinations", "assistant"],
  student: [
    "me",
    "courses",
    "library",
    "events",
    "clubs",
    "sports",
    "grievances",
    "feedback",
    "assistant",
  ],
  warden: ["hostel", "grievances", "assistant"],
  placement_officer: ["placements", "students", "assistant"],
  librarian: ["library", "assistant"],
  transport_manager: ["transport", "assistant"],
  doctor: ["health", "assistant"],
  security: ["visitors", "assistant"],
  accountant: ["finance", "assistant"],
  alumni: ["alumni", "events", "assistant"],
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator",
  hod: "Head of Department",
  faculty: "Faculty",
  student: "Student",
  warden: "Warden",
  placement_officer: "Placement Officer",
  librarian: "Librarian",
  transport_manager: "Transport Manager",
  doctor: "Medical Officer",
  security: "Security",
  accountant: "Accounts",
  alumni: "Alumnus",
};

// The Overview (/) is always reachable; so is the assistant. Everything else is gated.
export function canAccess(role: string | null | undefined, module: string): boolean {
  if (!role) return false;
  if (module === "" || module === "assistant") return true;
  // Attendance is marked by the people who teach: faculty, and a HOD for their department.
  if (module === "mark-attendance") return role === "faculty" || role === "hod";
  const a = ACCESS[role as Role];
  if (!a) return false;
  return a === "*" || a.includes(module);
}
