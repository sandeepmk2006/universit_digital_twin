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
} from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/db";

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
  const studentGroups: NavGroup[] = [
    [
      "You",
      [
        ["Overview", "/", LayoutDashboard],
        ...(studentId
          ? ([["My record", `/students/${studentId}`, GraduationCap]] as NavLink[])
          : []),
        ["Grievances", "/grievances", ShieldAlert],
        ["Feedback", "/feedback", MessageSquare],
        ["Assistant", "/assistant", MessageSquare],
      ],
    ],
    [
      "Campus",
      [
        ["Library", "/library", BookOpen],
        ["Events", "/events", CalendarDays],
        ["Clubs", "/clubs", Users],
        ["Sports", "/sports", LayoutDashboard],
      ],
    ],
  ];
  const nav: readonly NavGroup[] = isStudent ? studentGroups : groups;
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
              <div className="text-xs text-[var(--muted)]">{profile?.role ?? "student"}</div>
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
