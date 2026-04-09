/**
 * app/(dashboard)/admin/calendar/page.tsx
 *
 * Admin Calendar Page — shows organization calendar with:
 * - All approved leave requests
 * - All holidays
 * - All completed attendance sessions
 */

import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { redirect } from "next/navigation";
import CalendarView from "@/components/calendar/CalendarView";

export const metadata = {
  title: "Calendar | AgencyDesk",
};

export default async function AdminCalendarPage() {
  const session = await getSession();

  if (!session || !hasRole(session, "admin")) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
        <p className="mt-1 text-sm text-gray-600">
          Organization calendar with holidays, approved leaves, and attendance records
        </p>
      </div>

      {/* Calendar Component */}
      <CalendarView role="admin" />
    </div>
  );
}
