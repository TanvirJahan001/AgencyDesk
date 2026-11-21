/**
 * components/layout/DashboardShell.tsx
 *
 * Composes Sidebar + Header into the full dashboard chrome.
 * Wraps everything in AuthProvider so all client components
 * in the dashboard have access to useAuth().
 */

"use client";

import { useState } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import Sidebar from "./Sidebar";
import Header  from "./Header";
import type { DecodedSession } from "@/lib/auth/withRoleGuard";

type DashboardShellProps = { children: React.ReactNode } & (
  | { session: DecodedSession; demo?: never }
  | { demo: true; session?: never }
);

export default function DashboardShell({ session, children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = session?.role ?? "demo";
  const name = session?.name ?? session?.email ?? "Demo visitor";

  const frame = (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        role={role}
        userName={name}
        userEmail={session?.email ?? "Read-only access"}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <div className="flex flex-col lg:pl-64">
        <Header userName={name} userRole={role} onMobileOpen={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );

  return session ? <AuthProvider>{frame}</AuthProvider> : frame;
}
