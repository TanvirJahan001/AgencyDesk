/**
 * components/layout/Sidebar.tsx — Role-Filtered Navigation Sidebar
 *
 * Employee  (12 items): Dashboard · Attendance History · Correction Requests · My Timesheets · My Payroll · My Invoices · My Projects · My Leave · My Expenses · My Documents · Announcements · Profile
 * Admin     (20 items): Dashboard · Employees · Departments · Documents · Attendance · Correction Requests · Timesheets · Payroll · Reports · Missed Checkouts · Invoices · Clients · Projects · Leave Mgmt · Holidays · Expenses · Finance · Announcements · Cron Logs · Settings · Profile
 * CEO       (12 items): Dashboard · Employees · Departments · Documents · Attendance · Correction Requests · Timesheets · Payroll · Reports · Missed Checkouts · Invoices · Clients · Projects · Leave Mgmt · Holidays · Expenses · Finance · Announcements · Cron Logs · Profile
 */

"use client";

import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";
import {
  AlertTriangle,
  Bell,
  Building2,
  CalendarClock,
  CalendarDays,
  Clock,
  DollarSign,
  FileBarChart,
  FileCheck,
  FileEdit,
  FileText,
  FolderKanban,
  FolderOpen,
  History,
  LayoutDashboard,
  Loader2,
  LogOut,
  Megaphone,
  PieChart,
  Receipt,
  Settings,
  Umbrella,
  UserCircle,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

// ── Navigation definitions ────────────────────────────────────

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: UserRole[];
  exact?: boolean; // exact match only for root paths
};

const NAV_ITEMS: NavItem[] = [
  // ─ Employee ─
  { label: "Dashboard",            href: "/employee",             icon: LayoutDashboard, roles: ["employee"], exact: true },
  { label: "Attendance History",   href: "/employee/attendance",  icon: Clock,           roles: ["employee"] },
  { label: "Correction Requests",  href: "/employee/corrections", icon: FileEdit,        roles: ["employee"] },
  { label: "My Timesheets",        href: "/employee/timesheets",  icon: CalendarClock,   roles: ["employee"] },
  { label: "My Payroll",           href: "/employee/payroll",     icon: DollarSign,      roles: ["employee"] },
  { label: "My Payslips",          href: "/employee/payslips",    icon: FileText,        roles: ["employee"] },
  { label: "My Invoices",          href: "/employee/invoices",    icon: Receipt,         roles: ["employee"] },
  { label: "My Projects",          href: "/employee/projects",    icon: FolderKanban,    roles: ["employee"] },
  { label: "My Leave",             href: "/employee/leave",       icon: Umbrella,        roles: ["employee"] },
  { label: "My Expenses",          href: "/employee/expenses",    icon: Wallet,          roles: ["employee"] },
  { label: "My Documents",         href: "/employee/documents",   icon: FolderOpen,      roles: ["employee"] },
  { label: "Calendar",             href: "/employee/calendar",    icon: CalendarDays,    roles: ["employee"] },
  { label: "Announcements",        href: "/employee/announcements", icon: Megaphone,     roles: ["employee"] },
  { label: "Notifications",        href: "/employee/notifications", icon: Bell,          roles: ["employee"] },
  { label: "Profile",              href: "/employee/profile",     icon: UserCircle,      roles: ["employee"] },

  // ─ Admin ─
  { label: "Dashboard",            href: "/admin",                icon: LayoutDashboard, roles: ["admin"], exact: true },
  { label: "Employees",            href: "/admin/employees",      icon: Users,           roles: ["admin"] },
  { label: "Departments",          href: "/admin/departments",    icon: Building2,       roles: ["admin"] },
  { label: "Documents",            href: "/admin/documents",      icon: FolderOpen,      roles: ["admin"] },
  { label: "Onboarding",           href: "/admin/onboarding",     icon: UserPlus,        roles: ["admin"] },
  { label: "Attendance",           href: "/admin/attendance",     icon: Clock,           roles: ["admin"] },
  { label: "Correction Requests",  href: "/admin/corrections",    icon: FileEdit,        roles: ["admin"] },
  { label: "Timesheets",           href: "/admin/timesheets",     icon: FileCheck,       roles: ["admin"] },
  { label: "Payroll",              href: "/admin/payroll",        icon: DollarSign,      roles: ["admin"] },
  { label: "Payslips",             href: "/admin/payslips",       icon: FileText,        roles: ["admin"] },
  { label: "Reports",              href: "/admin/reports",        icon: FileBarChart,    roles: ["admin"] },
  { label: "Analytics",            href: "/admin/analytics",       icon: PieChart,        roles: ["admin"] },
  { label: "Missed Checkouts",     href: "/admin/missed-checkouts", icon: AlertTriangle, roles: ["admin"] },
  { label: "Invoices",             href: "/admin/invoices",       icon: Receipt,         roles: ["admin"] },
  { label: "Clients",              href: "/admin/clients",        icon: Building2,       roles: ["admin"] },
  { label: "Projects",             href: "/admin/projects",       icon: FolderKanban,    roles: ["admin"] },
  { label: "Leave Management",     href: "/admin/leave",          icon: Umbrella,        roles: ["admin"] },
  { label: "My Leave",             href: "/admin/my-leave",       icon: Umbrella,        roles: ["admin"] },
  { label: "Holidays",             href: "/admin/holidays",       icon: CalendarDays,    roles: ["admin"] },
  { label: "Calendar",             href: "/admin/calendar",       icon: CalendarDays,    roles: ["admin"] },
  { label: "Expenses",             href: "/admin/expenses",       icon: Wallet,          roles: ["admin"] },
  { label: "Contracts",            href: "/admin/contracts",      icon: FileCheck,       roles: ["admin"] },
  { label: "Finance",              href: "/admin/finance",        icon: PieChart,        roles: ["admin"] },
  { label: "Announcements",        href: "/admin/announcements",  icon: Megaphone,       roles: ["admin"] },
  { label: "Notifications",        href: "/admin/notifications",  icon: Bell,            roles: ["admin"] },
  { label: "Cron Logs",            href: "/admin/cron",           icon: History,         roles: ["admin"] },
  { label: "Audit Logs",           href: "/admin/audit-logs",     icon: FileBarChart,    roles: ["admin"] },
  { label: "Activity",             href: "/admin/activity",       icon: History,         roles: ["admin"] },
  { label: "Data Export",          href: "/admin/export",         icon: FileBarChart,    roles: ["admin"] },
  { label: "Bulk Operations",      href: "/admin/bulk",           icon: FileBarChart,    roles: ["admin"] },
  { label: "Settings",             href: "/admin/settings",       icon: Settings,        roles: ["admin"] },
  { label: "Profile",              href: "/admin/profile",        icon: UserCircle,      roles: ["admin"] },

  // ─ CEO ─
  { label: "Dashboard",            href: "/ceo",                  icon: LayoutDashboard, roles: ["ceo"], exact: true },
  { label: "Employees",            href: "/ceo/employees",        icon: Users,           roles: ["ceo"] },
  { label: "Departments",          href: "/ceo/departments",      icon: Building2,       roles: ["ceo"] },
  { label: "Documents",            href: "/ceo/documents",        icon: FolderOpen,      roles: ["ceo"] },
  { label: "Onboarding",           href: "/ceo/onboarding",       icon: UserPlus,        roles: ["ceo"] },
  { label: "Attendance",           href: "/ceo/attendance",       icon: Clock,           roles: ["ceo"] },
  { label: "Correction Requests",  href: "/ceo/corrections",      icon: FileEdit,        roles: ["ceo"] },
  { label: "Timesheets",           href: "/ceo/timesheets",       icon: FileCheck,       roles: ["ceo"] },
  { label: "Payroll",              href: "/ceo/payroll",          icon: DollarSign,      roles: ["ceo"] },
  { label: "Payslips",             href: "/ceo/payslips",         icon: FileText,        roles: ["ceo"] },
  { label: "Reports",              href: "/ceo/reports",          icon: FileBarChart,    roles: ["ceo"] },
  { label: "Analytics",            href: "/ceo/analytics",        icon: PieChart,        roles: ["ceo"] },
  { label: "Missed Checkouts",     href: "/ceo/missed-checkouts", icon: AlertTriangle,   roles: ["ceo"] },
  { label: "Invoices",             href: "/ceo/invoices",         icon: Receipt,         roles: ["ceo"] },
  { label: "Clients",              href: "/ceo/clients",          icon: Building2,       roles: ["ceo"] },
  { label: "Projects",             href: "/ceo/projects",         icon: FolderKanban,    roles: ["ceo"] },
  { label: "Leave Management",     href: "/ceo/leave",            icon: Umbrella,        roles: ["ceo"] },
  { label: "My Leave",             href: "/ceo/my-leave",         icon: Umbrella,        roles: ["ceo"] },
  { label: "Holidays",             href: "/ceo/holidays",         icon: CalendarDays,    roles: ["ceo"] },
  { label: "Calendar",             href: "/ceo/calendar",         icon: CalendarDays,    roles: ["ceo"] },
  { label: "Expenses",             href: "/ceo/expenses",         icon: Wallet,          roles: ["ceo"] },
  { label: "Contracts",            href: "/ceo/contracts",        icon: FileCheck,       roles: ["ceo"] },
  { label: "Finance",              href: "/ceo/finance",          icon: PieChart,        roles: ["ceo"] },
  { label: "Announcements",        href: "/ceo/announcements",    icon: Megaphone,       roles: ["ceo"] },
  { label: "Notifications",        href: "/ceo/notifications",    icon: Bell,            roles: ["ceo"] },
  { label: "Cron Logs",            href: "/ceo/cron",             icon: History,         roles: ["ceo"] },
  { label: "Audit Logs",           href: "/ceo/audit-logs",       icon: FileBarChart,    roles: ["ceo"] },
  { label: "Activity",             href: "/ceo/activity",         icon: History,         roles: ["ceo"] },
  { label: "Profile",              href: "/ceo/profile",          icon: UserCircle,      roles: ["ceo"] },
];

const ROLE_LABELS: Record<UserRole, string> = {
  admin:    "Admin",
  employee: "Employee",
  ceo:      "CEO",
};

// ── Props ─────────────────────────────────────────────────────

interface SidebarProps {
  role:       UserRole;
  userName:   string;
  userEmail:  string;
  mobileOpen: boolean;
  onClose:    () => void;
}

// ── Component ─────────────────────────────────────────────────

export default function Sidebar({
  role,
  userName,
  userEmail,
  mobileOpen,
  onClose,
}: SidebarProps) {
  const pathname    = usePathname();
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
  }

  function isActive(item: NavItem): boolean {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  const NavLinks = () => (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
      {visibleItems.map((item) => {
        const Icon   = item.icon;
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-brand-600 text-white"
                : "text-slate-300 hover:bg-slate-700 hover:text-white"
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const UserBlock = () => (
    <div className="border-t border-slate-700 p-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
          {userName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{userName}</p>
          <p className="truncate text-xs text-slate-400">{userEmail}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-700 hover:text-white disabled:opacity-50"
      >
        {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
      <p className="mt-2 text-center text-[10px] text-slate-500">
        Developed by Tanvir Jahan
      </p>
    </div>
  );

  const BrandHeader = ({ onCloseMobile }: { onCloseMobile?: () => void }) => (
    <div className="flex h-16 shrink-0 items-center justify-between px-5">
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold tracking-tight text-white">AgencyDesk</span>
        <span className="rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          {ROLE_LABELS[role]}
        </span>
      </div>
      {onCloseMobile && (
        <button onClick={onCloseMobile} className="text-slate-400 hover:text-white lg:hidden">
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:bg-slate-900 dark:bg-slate-950 lg:fixed lg:inset-y-0">
        <BrandHeader />
        <NavLinks />
        <UserBlock />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-900 dark:bg-slate-950 transition-transform duration-200 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <BrandHeader onCloseMobile={onClose} />
        <NavLinks />
        <UserBlock />
      </aside>
    </>
  );
}
