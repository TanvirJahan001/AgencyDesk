"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import InvoiceTable from "@/components/invoices/InvoiceTable";
import type { Invoice, InvoiceBillingType, InvoiceStatus } from "@/types";

export default function EmployeeInvoicesClient() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [billingTypeFilter, setBillingTypeFilter] =
    useState<InvoiceBillingType | "">(
      ""
    );
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "">("");

  // Fetch invoices
  useEffect(() => {
    async function fetchInvoices() {
      try {
        const res = await fetch("/api/invoices");
        const json = await res.json();

        if (!json.success) {
          setError(json.error || "Failed to load invoices");
          return;
        }

        setInvoices(Array.isArray(json.data) ? json.data : []);
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchInvoices();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...invoices];

    if (billingTypeFilter) {
      filtered = filtered.filter(
        (inv) => inv.billingType === billingTypeFilter
      );
    }

    if (statusFilter) {
      filtered = filtered.filter((inv) => inv.status === statusFilter);
    }

    setFilteredInvoices(filtered);
  }, [invoices, billingTypeFilter, statusFilter]);

  // Handle download
  async function handleDownload(id: string) {
    try {
      const res = await fetch(`/api/invoices/download/${id}`);
      if (!res.ok) {
        alert("Failed to download invoice");
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const invoice = invoices.find((inv) => inv.id === id);
      a.download = `${invoice?.invoiceNumber || "invoice"}.pdf`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Error downloading invoice");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Billing Type
          </label>
          <select
            value={billingTypeFilter}
            onChange={(e) =>
              setBillingTypeFilter(e.target.value as InvoiceBillingType | "")
            }
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Types</option>
            <option value="hourly">Hourly</option>
            <option value="weekly">Weekly</option>
            <option value="bi-weekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
            <option value="project-based">Project-based</option>
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | "")}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="issued">Issued</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={() => {
              setBillingTypeFilter("");
              setStatusFilter("");
            }}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Results info */}
      <div className="text-sm text-slate-500">
        Showing {filteredInvoices.length} of {invoices.length} invoices
      </div>

      {/* Table */}
      <InvoiceTable
        invoices={filteredInvoices}
        showEmployee={false}
        onDownload={handleDownload}
      />
    </div>
  );
}
