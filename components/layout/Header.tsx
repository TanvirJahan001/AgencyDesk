/**
 * components/layout/Header.tsx
 *
 * Top header bar for all roles:
 *  - Mobile hamburger toggle
 *  - Page title (derived from pathname)
 *  - Role badge (Admin / Employee / CEO)
 *  - Notification bell with real unread count + dropdown
 *  - User avatar with name tooltip
 */

"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import NotificationBell from "@/components/notifications/NotificationBell";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

interface HeaderProps {
  userName:     string;
  userRole:     UserRole;
  onMobileOpen: () => void;
}

const ROLE_BADGE: Record<UserRole, { label: string; cls: string }> = {
  admin:    { label: "Admin",    cls: "bg-blue-100 text-blue-800"   },
  employee: { label: "Employee", cls: "bg-green-100 text-green-800" },
  ceo:      { label: "CEO",      cls: "bg-purple-100 text-purple-800" },
};

/** Derives a human-readable page title from the current pathname. */
function usePageTitle(): string {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  // Skip role prefix (admin / employee / ceo) and use last meaningful segment
  const relevant = segments.length > 1 ? segments.slice(1) : segments;
  const segment  = relevant.pop() ?? "dashboard";
  return segment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Header({ userName, userRole, onMobileOpen }: HeaderProps) {
  const title = usePageTitle();
  const badge = ROLE_BADGE[userRole];

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
      {/* Mobile menu toggle */}
      <button
        onClick={onMobileOpen}
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
        aria-label="Open sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Page title */}
      <h1 className="flex-1 text-base font-semibold text-slate-900 lg:text-lg truncate">
        {title}
      </h1>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Role badge — visible on md+ screens */}
        <span className={cn(
          "hidden md:inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
          badge.cls
        )}>
          {badge.label}
        </span>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notification bell */}
        <NotificationBell />

        {/* User avatar */}
        <div
          className="flex h-8 w-8 cursor-default items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white"
          title={`${userName} (${badge.label})`}
          aria-label={`Signed in as ${userName}`}
        >
          {userName.charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
}
