/**
 * app/(dashboard)/admin/invoices/page.tsx
 *
 * Admin invoice management page with tabs:
 *   1. All Invoices — view, filter, and update status
 *   2. Generate Invoice — create new invoices
 */

import { Metadata } from "next";
import { FileText } from "lucide-react";
import AdminInvoicesClient from "./AdminInvoicesClient";

export const metadata: Metadata = {
  title: "Invoices",
};

export default function AdminInvoicesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
          <FileText className="h-5 w-5 text-brand-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-500">
            Manage invoices and generate new ones for employees.
          </p>
        </div>
      </div>

      {/* Client Component */}
      <AdminInvoicesClient />
    </div>
  );
}
