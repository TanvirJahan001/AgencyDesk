"use client";

import { useState } from "react";
import { Download, Loader2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Invoice, InvoiceStatus } from "@/types";

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft:     "bg-slate-100 text-slate-700",
  issued:    "bg-blue-100 text-blue-800",
  paid:      "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-700",
};

interface InvoiceTableProps {
  invoices: Invoice[];
  showEmployee?: boolean;
  onDownload?: (id: string) => void;
  onStatusChange?: (id: string, status: InvoiceStatus) => void;
}

export default function InvoiceTable({
  invoices,
  showEmployee = true,
  onDownload,
  onStatusChange,
}: InvoiceTableProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function handleDownload(id: string) {
    if (!onDownload) return;
    setDownloadingId(id);
    try {
      onDownload(id);
    } finally {
      setTimeout(() => setDownloadingId(null), 2000);
    }
  }

  if (invoices.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center text-sm text-slate-400">
        <FileText className="mx-auto mb-3 h-8 w-8 text-slate-300" />
        No invoices found.
      </div>
    );
  }

  const headers = [
    "Invoice #",
    ...(showEmployee ? ["Employee"] : []),
    "Type",
    "Period",
    "Total",
    "Status",
    "Created",
    "Actions",
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-100 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {invoices.map((inv) => (
            <tr key={inv.id} className="hover:bg-slate-50/60">
              <td className="px-4 py-3 font-medium text-slate-900">
                {inv.invoiceNumber}
              </td>
              {showEmployee && (
                <td className="px-4 py-3 text-slate-600">{inv.employeeName}</td>
              )}
              <td className="px-4 py-3 text-slate-600 capitalize">
                {inv.billingType}
              </td>
              <td className="px-4 py-3 text-slate-600">{inv.periodLabel}</td>
              <td className="px-4 py-3 tabular-nums font-medium text-slate-900">
                ${inv.total.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </td>
              <td className="px-4 py-3">
                {onStatusChange ? (
                  <select
                    value={inv.status}
                    onChange={(e) =>
                      onStatusChange(inv.id, e.target.value as InvoiceStatus)
                    }
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium border-0 cursor-pointer",
                      STATUS_COLORS[inv.status]
                    )}
                  >
                    <option value="draft">Draft</option>
                    <option value="issued">Issued</option>
                    <option value="paid">Paid</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                ) : (
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                      STATUS_COLORS[inv.status]
                    )}
                  >
                    {inv.status}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-slate-500">
                {new Date(inv.createdAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => handleDownload(inv.id)}
                  disabled={downloadingId === inv.id}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-50"
                  title="Download PDF"
                >
                  {downloadingId === inv.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  PDF
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
