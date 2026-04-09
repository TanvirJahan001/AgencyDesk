/**
 * components/payroll/AdminPayrollDashboard.tsx
 *
 * Full admin payroll management:
 *  - Generate payroll (single employee or bulk)
 *  - Summary stats cards
 *  - Filterable table with expand-to-detail
 *  - Process / Mark Paid status transitions
 */

"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import type { PayrollRun } from "@/types";
import { fmtCurrency, minToHours, minToReadable } from "@/lib/payroll/utils";
import PayrollRunDetail from "./PayrollRunDetail";
import { cn } from "@/lib/utils";
import {
  Play,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  DollarSign,
  Clock,
  Users,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft:     "bg-yellow-100 text-yellow-800",
  processed: "bg-blue-100 text-blue-800",
  paid:      "bg-green-100 text-green-800",
};

export default function AdminPayrollDashboard() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Generate modal
  const [showGenerate, setShowGenerate] = useState(false);
  const [genPeriodType, setGenPeriodType] = useState<"weekly" | "monthly">("weekly");
  const [genPeriodLabel, setGenPeriodLabel] = useState("");
  const [genLoading, setGenLoading] = useState(false);

  // Action loading
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // ── Data fetching ──────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      const res = await fetch(`/api/payroll?${params.toString()}`);
      const data = await res.json();
      if (data.success) setRuns(data.data);
      else setError(data.error);
    } catch {
      setError("Failed to load payroll data.");
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Client-side employee filter ────────────────────────────

  const filtered = runs.filter((r) => {
    if (filterEmployee) {
      const q = filterEmployee.toLowerCase();
      if (
        !r.employeeName.toLowerCase().includes(q) &&
        !r.employeeId.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  // ── Stats ──────────────────────────────────────────────────

  const draftCount     = runs.filter((r) => r.status === "draft").length;
  const processedCount = runs.filter((r) => r.status === "processed").length;
  const paidCount      = runs.filter((r) => r.status === "paid").length;
  const totalGross     = runs.reduce((s, r) => s + r.grossPay, 0);

  // ── Handlers ───────────────────────────────────────────────

  async function handleGenerate() {
    if (!genPeriodLabel.trim()) return;
    setGenLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodType: genPeriodType, periodLabel: genPeriodLabel }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setShowGenerate(false);
      setGenPeriodLabel("");
      await fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setGenLoading(false);
    }
  }

  async function handleAction(runId: string, action: "process" | "pay") {
    setActionLoadingId(runId);
    setError(null);
    try {
      const res = await fetch(`/api/payroll/${runId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setActionLoadingId(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Stats cards ───────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Clock className="h-5 w-5 text-yellow-600" />}
          label="Draft" value={draftCount} bg="bg-yellow-50"
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5 text-blue-600" />}
          label="Processed" value={processedCount} bg="bg-blue-50"
        />
        <StatCard
          icon={<DollarSign className="h-5 w-5 text-green-600" />}
          label="Paid" value={paidCount} bg="bg-green-50"
        />
        <StatCard
          icon={<Users className="h-5 w-5 text-brand-600" />}
          label="Total Gross" value={fmtCurrency(totalGross)} bg="bg-brand-50"
        />
      </div>

      {/* ── Filters & Actions ─────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search employee…"
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-gray-300 py-2 pl-3 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="processed">Processed</option>
            <option value="paid">Paid</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => setShowGenerate(true)}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          <Play className="h-4 w-4" />
          Run Payroll
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12 text-center text-sm text-gray-500">
          No payroll runs found. Click &quot;Run Payroll&quot; to generate.
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-left">
                  <th className="w-8 px-3 py-3" />
                  <th className="px-4 py-3 font-medium text-gray-600">Employee</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Period</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right">Regular</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right">Overtime</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right">Gross</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right">Net</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-center">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((run) => {
                  const isExpanded = expandedId === run.id;
                  return (
                    <Fragment key={run.id}>
                      <tr
                        className={cn(
                          "border-b border-gray-50 transition-colors cursor-pointer",
                          isExpanded ? "bg-brand-50/30" : "hover:bg-gray-50"
                        )}
                        onClick={() => setExpandedId(isExpanded ? null : run.id)}
                      >
                        <td className="px-3 py-3">
                          {isExpanded
                            ? <ChevronDown className="h-4 w-4 text-gray-400" />
                            : <ChevronRight className="h-4 w-4 text-gray-400" />}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{run.employeeName}</td>
                        <td className="px-4 py-3 text-gray-700">{run.period}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {minToReadable(run.regularMin)}
                          <span className="ml-1 text-gray-400">{fmtCurrency(run.regularPay)}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {run.overtimeMin > 0 ? (
                            <>
                              {minToReadable(run.overtimeMin)}
                              <span className="ml-1 text-orange-600">{fmtCurrency(run.overtimePay)}</span>
                            </>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">{fmtCurrency(run.grossPay)}</td>
                        <td className="px-4 py-3 text-right font-bold text-brand-700">{fmtCurrency(run.netPay)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_COLORS[run.status])}>
                            {run.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          {run.status === "draft" && (
                            <button
                              onClick={() => handleAction(run.id, "process")}
                              disabled={actionLoadingId === run.id}
                              className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                            >
                              {actionLoadingId === run.id ? "…" : "Process"}
                            </button>
                          )}
                          {run.status === "processed" && (
                            <button
                              onClick={() => handleAction(run.id, "pay")}
                              disabled={actionLoadingId === run.id}
                              className="rounded-lg bg-green-50 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 transition-colors"
                            >
                              {actionLoadingId === run.id ? "…" : "Mark Paid"}
                            </button>
                          )}
                          {run.status === "paid" && (
                            <span className="text-xs text-gray-400">Done</span>
                          )}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={9} className="bg-gray-50/40 px-6 py-4">
                            <PayrollRunDetail run={run} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Generate modal ────────────────────────────────── */}
      {showGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Play className="h-5 w-5 text-brand-600" />
              Run Payroll
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Calculate payroll for all employees in the selected period.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">Period Type</label>
                <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50">
                  <button
                    type="button"
                    onClick={() => setGenPeriodType("weekly")}
                    className={cn(
                      "rounded-l-lg px-4 py-2 text-sm font-medium transition-colors",
                      genPeriodType === "weekly" ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-100"
                    )}
                  >Weekly</button>
                  <button
                    type="button"
                    onClick={() => setGenPeriodType("monthly")}
                    className={cn(
                      "rounded-r-lg px-4 py-2 text-sm font-medium transition-colors",
                      genPeriodType === "monthly" ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-100"
                    )}
                  >Monthly</button>
                </div>
              </div>

              <div>
                <label htmlFor="gen-period" className="mb-1.5 block text-xs font-medium text-gray-600">
                  Period Label
                </label>
                <input
                  id="gen-period"
                  type="text"
                  value={genPeriodLabel}
                  onChange={(e) => setGenPeriodLabel(e.target.value)}
                  placeholder={genPeriodType === "weekly" ? "2026-W15" : "2026-04"}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowGenerate(false); setGenPeriodLabel(""); }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >Cancel</button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={genLoading || !genPeriodLabel.trim()}
                className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {genLoading ? "Calculating…" : "Run Payroll"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: React.ReactNode; bg: string }) {
  return (
    <div className={cn("rounded-xl p-4", bg)}>
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}
