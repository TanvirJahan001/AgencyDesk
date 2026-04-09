/**
 * app/(dashboard)/admin/reports/page.tsx
 *
 * Admin — Export reports: weekly attendance Excel, monthly payroll Excel, PDF summary.
 */

"use client";

import ReportsDashboard from "@/components/reports/ReportsDashboard";
import { FileBarChart } from "lucide-react";

export default function AdminReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100">
          <FileBarChart className="h-5 w-5 text-brand-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500">
            Export company-ready attendance and payroll reports.
          </p>
        </div>
      </div>

      <ReportsDashboard />
    </div>
  );
}
