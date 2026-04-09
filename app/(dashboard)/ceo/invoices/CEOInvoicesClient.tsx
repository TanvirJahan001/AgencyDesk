"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import InvoiceTable from "@/components/invoices/InvoiceTable";
import InvoiceSummaryCards from "@/components/invoices/InvoiceSummaryCards";
import type {
  Invoice,
  InvoiceBillingType,
  InvoiceStatus,
  AppUser,
} from "@/types";

export default function CEOInvoicesClient() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Employees for filtering
  const [employees, setEmployees] = useState<AppUser[]>([]);

  // Filters
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [billingTypeFilter, setBillingTypeFilter] =
    useState<InvoiceBillingType | "">(
      ""
    );
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "">("");

  // Fetch invoices and employees
  useEffect(() => {
    async function fetchData() {
      try {
        const [invoicesRes, employeesRes] = await Promise.all([
          fetch("/api/invoices"),
          fetch("/api/employees"),
        ]);

        const invoicesJson = await invoicesRes.json();
        const employeesJson = await employeesRes.json();

        if (invoicesJson.success) {
          setInvoices(Array.isArray(invoicesJson.data) ? invoicesJson.data : []);
        } else {
          setError(invoicesJson.error || "Failed to load invoices");
        }

        if (employeesJson.success) {
          setEmployees(
            Array.isArray(employeesJson.data) ? employeesJson.data : []
          );
        }
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...invoices];

    if (employeeFilter) {
      filtered = filtered.filter((inv) => inv.userId === employeeFilter);
    }

    if (billingTypeFilter) {
      filtered = filtered.filter(
        (inv) => inv.billingType === billingTypeFilter
      );
    }

    if (statusFilter) {
      filtered = filtered.filter((inv) => inv.status === statusFilter);
    }

    setFilteredInvoices(filtered);
  }, [invoices, employeeFilter, billingTypeFilter, statusFilter]);

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

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <InvoiceSummaryCards />

      {/* Invoices Table */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : (
          <>
            {/* Filter Bar */}
            <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  Employee
                </label>
                <select
                  value={employeeFilter}
                  onChange={(e) => setEmployeeFilter(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">All Employees</option>
                  {employees.map((emp) => (
                    <option key={emp.uid} value={emp.uid}>
                      {emp.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  Billing Type
                </label>
                <select
                  value={billingTypeFilter}
                  onChange={(e) =>
                    setBillingTypeFilter(
                      e.target.value as InvoiceBillingType | ""
                    )
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
                  onChange={(e) =>
                    setStatusFilter(e.target.value as InvoiceStatus | "")
                  }
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
                    setEmployeeFilter("");
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
              showEmployee={true}
              onDownload={handleDownload}
            />
          </>
        )}
      </div>
    </div>
  );
}
