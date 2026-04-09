/**
 * app/(dashboard)/employee/payslips/EmployeePayslipsClient.tsx
 *
 * Employee payslips view with download buttons.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import type { Payslip } from "@/types";
import { fmtCurrency } from "@/lib/payroll/utils";
import { cn } from "@/lib/utils";
import {
  DollarSign,
  Download,
  FileText,
  Loader2,
  AlertCircle,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  generated: "bg-blue-100 text-blue-800",
  issued: "bg-green-100 text-green-800",
  viewed: "bg-gray-100 text-gray-800",
};

export default function EmployeePayslipsClient() {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchPayslips = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payslips");
      const data = await res.json();
      if (data.success) {
        setPayslips(data.data?.payslips || []);
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
    fetchPayslips();
  }, [fetchPayslips]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100">
          <FileText className="h-5 w-5 text-brand-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">My Payslips</h1>
          <p className="text-sm text-gray-500">
            Download and view your payslips.
          </p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-xs text-red-700 hover:text-red-900 mt-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

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
          <DollarSign className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <p className="text-sm font-medium text-gray-900">No payslips yet</p>
          <p className="text-xs text-gray-500 mt-1">
            Payslips will appear here once your admin generates them.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {payslips.map((payslip) => (
            <div
              key={payslip.id}
              className="rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left: Period and dates */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {payslip.period}
                  </p>
                  <p className="text-xs text-gray-500">
                    {payslip.periodStart} to {payslip.periodEnd}
                  </p>
                </div>

                {/* Middle: Financial info */}
                <div className="flex gap-6">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Gross Pay</p>
                    <p className="text-sm font-mono font-semibold text-gray-900">
                      {fmtCurrency(payslip.grossPay)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Deductions</p>
                    <p className="text-sm font-mono font-semibold text-red-600">
                      {fmtCurrency(payslip.totalDeductions)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Net Pay</p>
                    <p className="text-sm font-mono font-semibold text-brand-700">
                      {fmtCurrency(payslip.netPay)}
                    </p>
                  </div>
                </div>

                {/* Right: Status and action */}
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                      STATUS_COLORS[payslip.status] || "bg-gray-100 text-gray-800"
                    )}
                  >
                    {payslip.status}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleDownload(payslip.id, payslip.employeeName, payslip.period)
                    }
                    disabled={downloading === payslip.id}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {downloading === payslip.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Download
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
