/**
 * components/timesheets/AdminTimesheetDashboard.tsx
 *
 * Admin view with:
 *  - Filter by employee, status, date range
 *  - Approve / Reject submitted timesheets
 *  - Lock payroll periods
 *  - Summary stats cards
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import type { Timesheet, PayrollLock } from "@/types";
import { msToDecimalHours, msToReadable } from "@/lib/attendance/utils";
import { formatWeekDisplay, formatMonthDisplay } from "@/lib/timesheets/utils";
import TimesheetWeeklyView from "./TimesheetWeeklyView";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  Lock,
  CheckCircle2,
  XCircle,
  Clock,
  FileCheck,
} from "lucide-react";

// ── Status colour helpers ────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  draft:     "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  approved:  "bg-green-100 text-green-700",
  rejected:  "bg-red-100 text-red-700",
};

// ── Component ────────────────────────────────────────────────

export default function AdminTimesheetDashboard() {
  // ── State ────────────────────────────────────────────────
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [locks, setLocks] = useState<PayrollLock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterEmployee, setFilterEmployee] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Review modal state
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject">("approve");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);

  // Lock modal state
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockPeriodLabel, setLockPeriodLabel] = useState("");
  const [lockPeriodType, setLockPeriodType] = useState<"weekly" | "monthly">("weekly");
  const [lockLoading, setLockLoading] = useState(false);

  // ── Data fetching ────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);

      const [tsRes, lockRes] = await Promise.all([
        fetch(`/api/timesheets?${params.toString()}`),
        fetch("/api/timesheets/lock"),
      ]);

      const tsData = await tsRes.json();
      const lockData = await lockRes.json();

      if (tsData.success) setTimesheets(tsData.data);
      else setError(tsData.error);

      if (lockData.success) setLocks(lockData.data);
    } catch {
      setError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Filtering ────────────────────────────────────────────

  const filtered = timesheets.filter((ts) => {
    if (filterEmployee) {
      const q = filterEmployee.toLowerCase();
      if (
        !ts.employeeName.toLowerCase().includes(q) &&
        !ts.employeeId.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  // Stats
  const submittedCount = timesheets.filter((t) => t.status === "submitted").length;
  const approvedCount  = timesheets.filter((t) => t.status === "approved").length;
  const totalHours     = timesheets.reduce((s, t) => s + t.totalWorkMs, 0);

  // ── Handlers ─────────────────────────────────────────────

  async function handleReview() {
    if (!reviewingId) return;
    setReviewLoading(true);
    try {
      const res = await fetch(`/api/timesheets/${reviewingId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: reviewAction, note: reviewNote || undefined }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setReviewingId(null);
      setReviewNote("");
      await fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Review failed.");
    } finally {
      setReviewLoading(false);
    }
  }

  async function handleLock() {
    if (!lockPeriodLabel) return;
    setLockLoading(true);
    try {
      const res = await fetch("/api/timesheets/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodType: lockPeriodType, periodLabel: lockPeriodLabel }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setShowLockModal(false);
      setLockPeriodLabel("");
      await fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lock failed.");
    } finally {
      setLockLoading(false);
    }
  }

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Stats cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<FileCheck className="h-5 w-5 text-blue-600" />} label="Pending Review" value={submittedCount} bg="bg-blue-50" />
        <StatCard icon={<CheckCircle2 className="h-5 w-5 text-green-600" />} label="Approved" value={approvedCount} bg="bg-green-50" />
        <StatCard icon={<Clock className="h-5 w-5 text-brand-600" />} label="Total Hours" value={`${msToDecimalHours(totalHours)}h`} bg="bg-brand-50" />
        <StatCard icon={<Lock className="h-5 w-5 text-gray-600" />} label="Locked Periods" value={locks.length} bg="bg-gray-100" />
      </div>

      {/* ── Filters & Actions ───────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Employee search */}
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

        {/* Status filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-gray-300 py-2 pl-3 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Lock button */}
        <button
          type="button"
          onClick={() => setShowLockModal(true)}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
        >
          <Lock className="h-4 w-4" />
          Lock Period
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12 text-center text-sm text-gray-500">
          No timesheets match your filters.
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
                  <th className="px-4 py-3 font-medium text-gray-600">Date Range</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right">Hours</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-center">Days</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-center">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ts) => {
                  const isExpanded = expandedId === ts.id;
                  const periodDisplay =
                    ts.periodType === "weekly"
                      ? formatWeekDisplay(ts.periodStart, ts.periodEnd)
                      : formatMonthDisplay(ts.periodLabel);

                  return (
                    <Fragment key={ts.id}>
                      <tr
                        className={cn(
                          "border-b border-gray-50 transition-colors cursor-pointer",
                          isExpanded ? "bg-brand-50/30" : "hover:bg-gray-50"
                        )}
                        onClick={() => setExpandedId(isExpanded ? null : ts.id)}
                      >
                        <td className="px-3 py-3">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{ts.employeeName}</td>
                        <td className="px-4 py-3 text-gray-700">{ts.periodLabel}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{periodDisplay}</td>
                        <td className="px-4 py-3 text-right font-mono">{msToDecimalHours(ts.totalWorkMs)}h</td>
                        <td className="px-4 py-3 text-center">{ts.totalDaysWorked}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_COLORS[ts.status])}>
                            {ts.status}
                            {ts.locked && " (locked)"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          {ts.status === "submitted" && !ts.locked && (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setReviewingId(ts.id);
                                  setReviewAction("approve");
                                }}
                                className="rounded-lg bg-green-50 p-1.5 text-green-700 hover:bg-green-100 transition-colors"
                                title="Approve"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setReviewingId(ts.id);
                                  setReviewAction("reject");
                                }}
                                className="rounded-lg bg-red-50 p-1.5 text-red-700 hover:bg-red-100 transition-colors"
                                title="Reject"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                          {ts.status !== "submitted" && (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="bg-gray-50/40 px-6 py-4">
                            <TimesheetWeeklyView timesheet={ts} />
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

      {/* ── Locked Periods ──────────────────────────────────── */}
      {locks.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Lock className="h-4 w-4 text-gray-500" />
            Locked Payroll Periods
          </h3>
          <div className="flex flex-wrap gap-2">
            {locks.map((lock) => (
              <span
                key={lock.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
                title={`Locked by ${lock.lockedByName} on ${new Date(lock.lockedAt).toLocaleDateString()}`}
              >
                <Lock className="h-3 w-3" />
                {lock.periodLabel}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Review Modal ────────────────────────────────────── */}
      {reviewingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">
              {reviewAction === "approve" ? "Approve Timesheet" : "Reject Timesheet"}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {reviewAction === "approve"
                ? "This will mark the timesheet as approved."
                : "The employee will be able to revise and resubmit."}
            </p>

            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="Optional note…"
              rows={3}
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setReviewingId(null); setReviewNote(""); }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReview}
                disabled={reviewLoading}
                className={cn(
                  "rounded-lg px-5 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50",
                  reviewAction === "approve"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                )}
              >
                {reviewLoading ? "Processing…" : reviewAction === "approve" ? "Approve" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lock Modal ──────────────────────────────────────── */}
      {showLockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Lock Payroll Period
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Locking prevents all future edits to timesheets and sessions in this period.
              This action cannot be undone.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">Period Type</label>
                <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50">
                  <button
                    type="button"
                    onClick={() => setLockPeriodType("weekly")}
                    className={cn(
                      "rounded-l-lg px-4 py-2 text-sm font-medium transition-colors",
                      lockPeriodType === "weekly" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
                    )}
                  >
                    Weekly
                  </button>
                  <button
                    type="button"
                    onClick={() => setLockPeriodType("monthly")}
                    className={cn(
                      "rounded-r-lg px-4 py-2 text-sm font-medium transition-colors",
                      lockPeriodType === "monthly" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
                    )}
                  >
                    Monthly
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="lock-label" className="mb-1.5 block text-xs font-medium text-gray-600">
                  Period Label
                </label>
                <input
                  id="lock-label"
                  type="text"
                  value={lockPeriodLabel}
                  onChange={(e) => setLockPeriodLabel(e.target.value)}
                  placeholder={lockPeriodType === "weekly" ? "2026-W15" : "2026-04"}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowLockModal(false); setLockPeriodLabel(""); }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLock}
                disabled={lockLoading || !lockPeriodLabel.trim()}
                className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {lockLoading ? "Locking…" : "Lock Period"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-component ────────────────────────────────────────────

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

// Need Fragment for table rows
import { Fragment } from "react";
