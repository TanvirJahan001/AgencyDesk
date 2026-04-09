/**
 * app/(dashboard)/admin/payslips/AdminPayslipsClient.tsx
 *
 * Admin payslips management with generation and bulk download.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import type { Payslip } from "@/types";
import { fmtCurrency } from "@/lib/payroll/utils";
import { cn } from "@/lib/utils";
import {
  Download,
  FileText,
  Loader2,
  AlertCircle,
  Plus,
  Filter,
  X,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  generated: "bg-blue-100 text-blue-800",
  issued: "bg-green-100 text-green-800",
  viewed: "bg-gray-100 text-gray-800",
};

interface GenerateModalState {
  open: boolean;
  period: string;
  generating: boolean;
}

export default function AdminPayslipsClient() {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Map<string, string>>(new Map());
  const [modal, setModal] = useState<GenerateModalState>({
    open: false,
    period: "",
    generating: false,
  });

  const fetchPayslips = useCallback(async (employeeIdFilter?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (employeeIdFilter) params.append("employeeId", employeeIdFilter);

      const res = await fetch(`/api/payslips?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setPayslips(data.data?.payslips || []);

        // Extract unique employees
        const empMap = new Map<string, string>();
        for (const p of data.data?.payslips || []) {
          empMap.set(p.employeeId, p.employeeName);
        }
        setEmployees(empMap);
      } else {
        setError(data.error || "Failed to load payslips");
      }
    } catch (err) {
      setError("Failed to load payslips");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayslips(selectedEmployeeId || undefined);
  }, [fetchPayslips, selectedEmployeeId]);

  const handleDownload = async (payslipId: string, employeeName: string, period: string) => {
    setDownloading(payslipId);
    try {
      const res = await fetch(`/api/payslips/${payslipId}/download`);
      if (!res.ok) {
        setError("Failed to download payslip");
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payslip_${employeeName.replace(/\s+/g, "_")}_${period}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError("Failed to download payslip");
    } finally {
      setDownloading(null);
    }
  };

  const handleGeneratePayslips = async () => {
    if (!modal.period.trim()) {
      setError("Please enter a period (e.g., 2026-04)");
      return;
    }

    setModal({ ...modal, generating: true });
    try {
      const res = await fetch("/api/payslips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: modal.period }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(`Generated ${data.data.count} payslips for period ${modal.period}`);
        setModal({ open: false, period: "", generating: false });
        await fetchPayslips(selectedEmployeeId || undefined);
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(data.error || "Failed to generate payslips");
      }
    } catch (err) {
      setError("Failed to generate payslips");
    } finally {
      setModal({ ...modal, generating: false });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100">
            <FileText className="h-5 w-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Payslips</h1>
            <p className="text-sm text-gray-500">
              Generate and manage employee payslips.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setModal({ ...modal, open: true })}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Generate Payslips
        </button>
      </div>

      {/* Success message */}
      {success && (
        <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
          <div>
            <p className="text-sm font-medium text-green-900">{success}</p>
          </div>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            className="ml-auto text-green-700 hover:text-green-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-700 hover:text-red-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-gray-400" />
        <label className="text-sm text-gray-600">Filter by employee:</label>
        <select
          value={selectedEmployeeId || ""}
          onChange={(e) => setSelectedEmployeeId(e.target.value || null)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        >
          <option value="">All employees</option>
          {Array.from(employees.entries()).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-2 text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading payslips...</span>
          </div>
        </div>
      ) : payslips.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <p className="text-sm font-medium text-gray-900">No payslips yet</p>
          <p className="text-xs text-gray-500 mt-1">
            Click "Generate Payslips" to create payslips from processed payroll runs.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">
                  Period
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-900">
                  Gross Pay
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-900">
                  Deductions
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-900">
                  Net Pay
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-900">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-900">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {payslips.map((payslip) => (
                <tr key={payslip.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {payslip.employeeName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {payslip.period}
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-right text-gray-900">
                    {fmtCurrency(payslip.grossPay)}
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-right text-red-600">
                    {fmtCurrency(payslip.totalDeductions)}
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-right font-semibold text-brand-700">
                    {fmtCurrency(payslip.netPay)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                        STATUS_COLORS[payslip.status] || "bg-gray-100 text-gray-800"
                      )}
                    >
                      {payslip.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      type="button"
                      onClick={() =>
                        handleDownload(payslip.id, payslip.employeeName, payslip.period)
                      }
                      disabled={downloading === payslip.id}
                      className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {downloading === payslip.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Generate Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-lg bg-white p-6 shadow-lg max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Generate Payslips</h2>
              <button
                type="button"
                onClick={() => setModal({ open: false, period: "", generating: false })}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1.5">
                  Period
                </label>
                <input
                  type="text"
                  placeholder="e.g., 2026-04 or 2026-W15"
                  value={modal.period}
                  onChange={(e) => setModal({ ...modal, period: e.target.value })}
                  disabled={modal.generating}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 disabled:bg-gray-50"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Will generate payslips for all processed payroll runs in this period.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModal({ open: false, period: "", generating: false })}
                  disabled={modal.generating}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGeneratePayslips}
                  disabled={modal.generating}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  {modal.generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
