/**
 * app/(dashboard)/employee/invoices/page.tsx
 *
 * Employee invoice page showing only their own invoices.
 * Includes filtering and download functionality.
 */

import { Metadata } from "next";
import { FileText } from "lucide-react";
import EmployeeInvoicesClient from "./EmployeeInvoicesClient";

export const metadata: Metadata = {
  title: "My Invoices",
};

export default function EmployeeInvoicesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
          <FileText className="h-5 w-5 text-brand-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">My Invoices</h1>
          <p className="text-sm text-slate-500">
            View and download your invoices.
          </p>
        </div>
      </div>

      {/* Client Component */}
      <EmployeeInvoicesClient />
    </div>
  );
}
