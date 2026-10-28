"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Bus,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  ScanLine,
  ShieldAlert,
  Users,
  X,
  UserRound,
  Wallet,
  CalendarCheck,
  Building2,
  ListChecks,
  FileText,
} from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/db";
import { ACCESS, ROLE_LABEL, type Role } from "@/lib/roles";

// module -> [label, href, icon, group], used to assemble each role's menu.
const MODMETA: Record<string, readonly [string, string, typeof Users, string]> = {
  students: ["Students", "/students", Users, "Academics"],
  faculty: ["Faculty", "/faculty", GraduationCap, "Academics"],
  courses: ["Courses", "/courses", BookOpen, "Academics"],
  timetable: ["Timetable", "/timetable", CalendarDays, "Academics"],
  attendance: ["Attendance", "/attendance", ClipboardCheck, "Academics"],
  examinations: ["Examinations", "/examinations", ScanLine, "Academics"],
  hostel: ["Hostel", "/hostel", LayoutDashboard, "Campus"],
  library: ["Library", "/library", BookOpen, "Campus"],
  transport: ["Transport", "/transport", Bus, "Campus"],
  events: ["Events", "/events", CalendarDays, "Campus"],
  clubs: ["Clubs", "/clubs", Users, "Campus"],
  sports: ["Sports", "/sports", LayoutDashboard, "Campus"],
  health: ["Health Centre", "/health", ClipboardCheck, "Campus"],
  visitors: ["Visitors", "/visitors", Users, "Campus"],
  admissions: ["Admissions", "/admissions", Users, "Administration"],
  placements: ["Placements", "/placements", BarChart3, "Administration"],
  research: ["Research", "/research", BookOpen, "Administration"],
  alumni: ["Alumni", "/alumni", Users, "Administration"],
  finance: ["Finance", "/finance", BarChart3, "Administration"],
  inventory: ["Inventory", "/inventory", LayoutDashboard, "Administration"],
  grievances: ["Grievances", "/grievances", ShieldAlert, "Administration"],
  feedback: ["Feedback", "/feedback", MessageSquare, "Administration"],
  insights: ["Insights", "/insights", BarChart3, "Intelligence"],
  allocation: ["Room Allocation", "/allocation", LayoutDashboard, "Intelligence"],
  assistant: ["Assistant", "/assistant", MessageSquare, "Intelligence"],
};

// Faculty think in terms of "my" classes, so relabel a couple of entries.
const FACULTY_LABELS: Record<string, string> = {
  students: "My students",
  courses: "My sections",
  timetable: "My timetable",
};

function buildNav(role: Role): NavGroup[] {
  const allowed = ACCESS[role];
  if (allowed === "*") return [...groups];
  const order = ["Academics", "Campus", "Administration", "Intelligence"];
  const out: NavGroup[] = [["", [["Overview", "/", LayoutDashboard]]]];
  for (const group of order) {
    const links = allowed
      .filter((m) => MODMETA[m]?.[3] === group)
      .map((m) => {
        const [label, href, icon] = MODMETA[m];
        return [role === "faculty" ? (FACULTY_LABELS[m] ?? label) : label, href, icon] as NavLink;
      });
    if (links.length) out.push([group, links]);
  }
  return out;
}

const groups = [
  [
    "Academics",
    [
      ["Students", "/students", Users],
      ["Faculty", "/faculty", GraduationCap],
      ["Courses", "/courses", BookOpen],
      ["Timetable", "/timetable", CalendarDays],
      ["Attendance", "/attendance", ClipboardCheck],
      ["Examinations", "/examinations", ScanLine],
    ],
  ],
  [
    "Campus",
    [
      ["Hostel", "/hostel", LayoutDashboard],
      ["Library", "/library", BookOpen],
      ["Transport", "/transport", Bus],
      ["Events", "/events", CalendarDays],
      ["Clubs", "/clubs", Users],
      ["Sports", "/sports", LayoutDashboard],
      ["Health Centre", "/health", ClipboardCheck],
      ["Visitors", "/visitors", Users],
    ],
  ],
  [
    "Administration",
    [
      ["Admissions", "/admissions", Users],
      ["Placements", "/placements", BarChart3],
      ["Research", "/research", BookOpen],
      ["Alumni", "/alumni", Users],
      ["Finance", "/finance", BarChart3],
      ["Inventory", "/inventory", LayoutDashboard],
      ["Grievances", "/grievances", ShieldAlert],
      ["Feedback", "/feedback", MessageSquare],
    ],
  ],
  [
    "Intelligence",
    [
      ["Insights", "/insights", BarChart3],
      ["Room Allocation", "/allocation", LayoutDashboard],
      ["Assistant", "/assistant", MessageSquare],
    ],
  ],
] as const;
type NavLink = readonly [string, string, typeof Users];
type NavGroup = readonly [string, readonly NavLink[]];

export function Shell({
  profile,
  term,
  studentId,
  children,
}: {
  profile: Profile | null;
  term: { name: string; week: number; total: number } | null;
  studentId: string | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const isStudent = profile?.role === "student";

  // Students get a personal menu, not the institution-wide directory.
  // Students get a personal portal laid out like EduServe, not the institution directory.
  const studentGroups: NavGroup[] = [
    [
      "My portal",
      [
        ["Dashboard", "/", LayoutDashboard],
        ["Personal Information", "/me/profile", UserRound],
        ["Classes", "/me/classes", BookOpen],
        ["Exams", "/me/exams", ScanLine],
        ["Fees", "/me/fees", Wallet],
        ["Leave", "/me/leave", CalendarCheck],
        ["Hostel", "/me/hostel", Building2],
        ["Registration", "/me/registration", ListChecks],
        ["Requests", "/me/requests", FileText],
        ["Study Assistant", "/me/study", GraduationCap],
      ],
    ],
    [
      "Campus",
      [
        ["Grievances", "/grievances", ShieldAlert],
        ["Feedback", "/feedback", MessageSquare],
        ["Library", "/library", BookOpen],
        ["Events", "/events", CalendarDays],
        ["Clubs", "/clubs", Users],
        ["Sports", "/sports", LayoutDashboard],
        ["Assistant", "/assistant", MessageSquare],
      ],
    ],
  ];

  const role = (profile?.role ?? "student") as Role;
  const nav: readonly NavGroup[] =
    role === "admin" ? groups : isStudent ? studentGroups : buildNav(role);
  return (
    <div className="min-h-screen md:flex">
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-60 border-r border-[var(--line)] bg-[var(--panel)] p-4 transition-transform md:static md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <GraduationCap size={20} className="text-indigo-600" />
            EduBase
          </Link>
          <button className="md:hidden" onClick={() => setOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <nav className="space-y-5">
          {nav.map(([group, links]) => (
            <div key={group}>
              <p className="mb-2 px-2 text-[11px] font-semibold text-[var(--muted)]">{group}</p>
              <div className="space-y-0.5">
                {links.map(([label, href, Icon]) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm ${path === href ? "bg-indigo-50 font-medium text-indigo-700" : "text-[var(--muted)] hover:bg-zinc-100"}`}
                  >
                    <Icon size={15} />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex h-14 items-center justify-between border-b border-[var(--line)] bg-[var(--panel)] px-4 md:px-8">
          <button className="md:hidden" onClick={() => setOpen(true)}>
            <Menu size={19} />
          </button>
          {term && (
            <div className="hidden items-baseline gap-2 sm:flex">
              <span className="text-sm font-medium">{term.name} term</span>
              <span className="text-xs text-[var(--muted)]">
                Week {term.week} of {term.total}
              </span>
            </div>
          )}
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-medium">{profile?.full_name ?? "User"}</div>
              <div className="text-xs text-[var(--muted)]">
                {ROLE_LABEL[(profile?.role ?? "student") as Role] ?? profile?.role}
              </div>
            </div>
            <form
              action={async () => {
                await createClient().auth.signOut();
                window.location.href = "/login";
              }}
            >
              <button className="focus-ring text-[var(--muted)]" title="Sign out">
                <LogOut size={17} />
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
