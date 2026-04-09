/**
 * app/(dashboard)/admin/missed-checkouts/page.tsx
 *
 * Admin — Missed checkout review, detection triggers, and cron job controls.
 */

"use client";

import AdminMissedCheckoutDashboard from "@/components/notifications/AdminMissedCheckoutDashboard";
import { AlertTriangle } from "lucide-react";

export default function AdminMissedCheckoutsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Missed Checkouts</h1>
          <p className="text-sm text-gray-500">
            Detect, review, and resolve missed checkout sessions.
          </p>
        </div>
      </div>

      <AdminMissedCheckoutDashboard />
    </div>
  );
}
