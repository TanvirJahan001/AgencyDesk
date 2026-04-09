/**
 * app/(dashboard)/admin/corrections/page.tsx
 *
 * Admin — Review pending correction requests from employees.
 * Approve or reject with optional notes. All actions are audit-logged.
 */

import type { Metadata } from "next";
import AdminCorrectionReview from "@/components/corrections/AdminCorrectionReview";

export const metadata: Metadata = { title: "Correction Requests" };

export default function AdminCorrectionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Correction Requests
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Review and approve or reject employee attendance correction requests.
          All actions are logged for audit.
        </p>
      </div>

      <AdminCorrectionReview />
    </div>
  );
}
