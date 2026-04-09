/**
 * components/notifications/AdminMissedCheckoutDashboard.tsx
 *
 * Admin UI for reviewing missed checkouts:
 *   - Manual detect trigger button
 *   - Filter by resolution status
 *   - Table of missed checkouts
 *   - Resolve modal (set adjusted end time + note)
 *   - Cron job trigger buttons (daily reminder, weekly CEO report)
 *   - Recent cron run log
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Mail,
  FileBarChart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MissedCheckout, CronRunLog } from "@/types";

type FilterStatus = "all" | "pending" | "auto_closed" | "admin_adjusted" | "employee_corrected";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:             { label: "Pending",            color: "bg-yellow-100 text-yellow-800" },
  auto_closed:         { label: "Auto-Closed",        color: "bg-orange-100 text-orange-800" },
  admin_adjusted:      { label: "Admin Adjusted",     color: "bg-green-100 text-green-800" },
  employee_corrected:  { label: "Employee Corrected", color: "bg-blue-100 text-blue-800" },
};

export default function AdminMissedCheckoutDashboard() {
  const [records, setRecords] = useState<MissedCheckout[]>([]);
  const [cronRuns, setCronRuns] = useState<CronRunLog[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [runningDaily, setRunningDaily] = useState(false);
  const [runningWeekly, setRunningWeekly] = useState(false);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolveTime, setResolveTime] = useState("");
  const [resolveNote, setResolveNote] = useState("");
  const [resolving, setResolving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter !== "all" ? `?resolution=${filter}` : "";
      const [mcRes, cronRes] = await Promise.all([
        fetch(`/api/missed-checkouts${params}`),
        fetch("/api/cron/runs?limit=5"),
      ]);

      const mcJson = await mcRes.json();
      if (mcJson.success) setRecords(mcJson.data);

      // Cron runs endpoint might not exist yet — handle gracefully
      if (cronRes.ok) {
        const cronJson = await cronRes.json();
        if (cronJson.success) setCronRuns(cronJson.data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleDetect() {
    setDetecting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/missed-checkouts", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: "success", text: `Detected ${json.data.detected} missed checkout(s).` });
        await fetchData();
      } else {
        setMessage({ type: "error", text: json.error || "Detection failed." });
      }
    } catch {
      setMessage({ type: "error", text: "Detection request failed." });
    } finally {
      setDetecting(false);
    }
  }

  async function handleDailyCron() {
    setRunningDaily(true);
    setMessage(null);
    try {
      const res = await fetch("/api/cron/daily-missed-checkout", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: "success", text: `Daily job: ${json.data.newlyDetected} new, ${json.data.totalPending} pending.` });
        await fetchData();
      } else {
        setMessage({ type: "error", text: json.error || "Daily cron failed." });
      }
    } catch {
      setMessage({ type: "error", text: "Daily cron request failed." });
    } finally {
      setRunningDaily(false);
    }
  }

  async function handleWeeklyCron() {
    setRunningWeekly(true);
    setMessage(null);
    try {
      const res = await fetch("/api/cron/weekly-ceo-report", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setMessage({
          type: "success",
          text: `CEO report sent. ${json.data.totalSessions} sessions, ${json.data.activeEmployees} active employees this week.`,
        });
      } else {
        setMessage({ type: "error", text: json.error || "Weekly report failed." });
      }
    } catch {
      setMessage({ type: "error", text: "Weekly report request failed." });
    } finally {
      setRunningWeekly(false);
    }
  }

  async function handleResolve() {
    if (!resolveId || !resolveTime) return;
    setResolving(true);
    try {
      const res = await fetch(`/api/missed-checkouts/${resolveId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolution: "admin_adjusted",
          adjustedEndTime: new Date(resolveTime).toISOString(),
          note: resolveNote || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: "success", text: "Missed checkout resolved." });
        setResolveId(null);
        setResolveTime("");
        setResolveNote("");
        await fetchData();
      } else {
        setMessage({ type: "error", text: json.error || "Resolution failed." });
      }
    } catch {
      setMessage({ type: "error", text: "Resolution request failed." });
    } finally {
      setResolving(false);
    }
  }

  const pendingCount = records.filter(
    (r) => r.resolution === "pending" || r.resolution === "auto_closed"
  ).length;

  return (
    <div className="space-y-6">
      {/* Header + Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleDetect}
          disabled={detecting}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Run Detection
        </button>

        <button
          onClick={handleDailyCron}
          disabled={runningDaily}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {runningDaily ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Daily Reminder
        </button>

        <button
          onClick={handleWeeklyCron}
          disabled={runningWeekly}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {runningWeekly ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileBarChart className="h-4 w-4" />}
          CEO Report
        </button>

        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Status message */}
      {message && (
        <div
          className={cn(
            "rounded-lg p-3 text-sm",
            message.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          )}
        >
          {message.text}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Total Records</p>
            <p className="text-xl font-semibold text-slate-900">{records.length}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-50">
            <Clock className="h-5 w-5 text-yellow-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Pending Review</p>
            <p className="text-xl font-semibold text-slate-900">{pendingCount}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Resolved</p>
            <p className="text-xl font-semibold text-slate-900">
              {records.filter((r) => r.resolution === "admin_adjusted" || r.resolution === "employee_corrected").length}
            </p>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {(["all", "auto_closed", "pending", "admin_adjusted", "employee_corrected"] as FilterStatus[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {f === "all" ? "All" : STATUS_LABELS[f]?.label || f}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center text-sm text-slate-400">
          No missed checkouts found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Employee</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Date</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Check-In</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Adjusted End</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Detected</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((mc) => {
                const statusInfo = STATUS_LABELS[mc.resolution] || { label: mc.resolution, color: "bg-slate-100 text-slate-800" };
                const canResolve = mc.resolution === "pending" || mc.resolution === "auto_closed";

                return (
                  <tr key={mc.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {mc.employeeName}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{mc.sessionDate}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(mc.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {mc.adjustedEndTime
                        ? new Date(mc.adjustedEndTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", statusInfo.color)}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {new Date(mc.detectedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {canResolve && (
                        <button
                          onClick={() => {
                            setResolveId(mc.id);
                            // Pre-fill with session date at 6 PM
                            setResolveTime(`${mc.sessionDate}T18:00`);
                            setResolveNote("");
                          }}
                          className="rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700"
                        >
                          Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Resolve Modal */}
      {resolveId && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setResolveId(null)} />
          <div className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Resolve Missed Checkout</h3>
            <p className="mt-1 text-sm text-slate-500">
              Set the correct end time for this session.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Adjusted End Time
                </label>
                <input
                  type="datetime-local"
                  value={resolveTime}
                  onChange={(e) => setResolveTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Note (optional)
                </label>
                <textarea
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  placeholder="e.g., Employee confirmed they left at 6 PM"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setResolveId(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={resolving || !resolveTime}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {resolving && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm Resolution
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
