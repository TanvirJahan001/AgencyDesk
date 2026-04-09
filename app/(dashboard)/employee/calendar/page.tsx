/**
 * app/(dashboard)/employee/calendar/page.tsx
 *
 * Employee Calendar Page — shows personal calendar with:
 * - Own attendance sessions
 * - Approved leave requests
 * - Holidays
 */

import { getSession } from "@/lib/auth/withRoleGuard";
import { redirect } from "next/navigation";
import CalendarView from "@/components/calendar/CalendarView";

export const metadata = {
  title: "Calendar | AgencyDesk",
};

export default async function EmployeeCalendarPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "employee") {
    redirect(`/${session.role}`);
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
        <p className="mt-1 text-sm text-gray-600">
          View your attendance, leave requests, and company holidays
        </p>
      </div>

      {/* Calendar Component */}
      <CalendarView role="employee" />
    </div>
  );
}
