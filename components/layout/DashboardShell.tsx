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

interface DashboardShellProps {
  session:  DecodedSession;
  children: React.ReactNode;
}

export default function DashboardShell({ session, children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <AuthProvider>
      <div className="min-h-screen bg-slate-50">
        {/* Sidebar */}
        <Sidebar
          role={session.role}
          userName={session.name ?? session.email}
          userEmail={session.email}
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />

        {/* Main content — offset by sidebar width on desktop */}
        <div className="flex flex-col lg:pl-64">
          <Header
            userName={session.name ?? session.email}
            userRole={session.role}
            onMobileOpen={() => setMobileOpen(true)}
          />

          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </AuthProvider>
  );
}
