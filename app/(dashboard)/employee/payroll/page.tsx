/**
 * app/(dashboard)/employee/payroll/page.tsx
 *
 * Employee — view payslip history with breakdown detail.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import type { PayrollRun } from "@/types";
import { fmtCurrency, minToReadable, minToHours } from "@/lib/payroll/utils";
import PayrollRunDetail from "@/components/payroll/PayrollRunDetail";
import { cn } from "@/lib/utils";
import { DollarSign, ChevronDown, ChevronRight } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft:     "bg-yellow-100 text-yellow-800",
  processed: "bg-blue-100 text-blue-800",
  paid:      "bg-green-100 text-green-800",
};

export default function EmployeePayrollPage() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payroll");
      const data = await res.json();
      if (data.success) setRuns(data.data);
      else setError(data.error);
    } catch {
      setError("Failed to load payslips.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100">
          <DollarSign className="h-5 w-5 text-brand-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">My Payslips</h1>
          <p className="text-sm text-gray-500">
            View your pay history and detailed breakdowns.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12 text-center text-sm text-gray-500">
          No payslips yet. Payslips appear after your admin runs payroll.
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => {
            const isExpanded = expandedId === run.id;
            return (
              <div key={run.id}>
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : run.id)}
                  className={cn(
                    "flex w-full items-center gap-4 rounded-xl border bg-white px-5 py-4 text-left transition-colors",
                    isExpanded
                      ? "border-brand-200 ring-1 ring-brand-100"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  {isExpanded
                    ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
                    : <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />}

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">{run.period}</p>
                    <p className="text-xs text-gray-500">
                      {run.periodStart} — {run.periodEnd}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-mono font-semibold text-gray-900">
                      {minToReadable(run.totalWorkMin)} ({minToHours(run.totalWorkMin)}h)
                    </p>
                    <p className="text-xs text-gray-500">Total work</p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold text-brand-700">{fmtCurrency(run.netPay)}</p>
                    <p className="text-xs text-gray-500">Net pay</p>
                  </div>

                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_COLORS[run.status])}>
                    {run.status}
                  </span>
                </button>

                {isExpanded && (
                  <div className="mt-2 ml-4">
                    <PayrollRunDetail run={run} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
