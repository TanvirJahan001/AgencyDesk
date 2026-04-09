/**
 * app/(dashboard)/ceo/invoices/page.tsx
 *
 * CEO invoice dashboard showing summary stats and a read-only list of all invoices.
 * No invoice editing or generation allowed at this level.
 */

import { Metadata } from "next";
import { FileText } from "lucide-react";
import CEOInvoicesClient from "./CEOInvoicesClient";

export const metadata: Metadata = {
  title: "Invoices",
};

export default function CEOInvoicesPage() {
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
            Overview of all employee invoices and financial metrics.
          </p>
        </div>
      </div>

      {/* Client Component */}
      <CEOInvoicesClient />
    </div>
  );
}
