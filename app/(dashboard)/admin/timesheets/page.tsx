/**
 * app/(dashboard)/admin/timesheets/page.tsx
 *
 * Admin timesheet management — review, approve, reject, lock.
 */

"use client";

import AdminTimesheetDashboard from "@/components/timesheets/AdminTimesheetDashboard";
import { FileCheck } from "lucide-react";

export default function AdminTimesheetsPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100">
          <FileCheck className="h-5 w-5 text-brand-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Timesheet Management</h1>
          <p className="text-sm text-gray-500">
            Review, approve, and lock employee timesheets.
          </p>
        </div>
      </div>

      <AdminTimesheetDashboard />
    </div>
  );
}
