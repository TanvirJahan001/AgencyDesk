/**
 * app/(dashboard)/admin/attendance/page.tsx — Admin Attendance Monitor
 *
 * Full-featured attendance table for admins/CEOs.
 *
 * Sections:
 *   1. Live stat bar: working now / on break / completed today / missed
 *   2. Filter bar: employee, date range, status
 *   3. Full sessions table with all columns
 *   4. Period totals row (sum of filtered results)
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Clock, Coffee, CheckCircle2, AlertTriangle, SlidersHorizontal } from "lucide-react";
import { minutesToReadable, minutesToDecimal, formatISO } from "@/lib/attendance/utils";
import { cn } from "@/lib/utils";
import type { AttendanceSessionV2 } from "@/types";

// ── Types ──────────────────────────────────────────────────────

interface EmployeeOption {
  uid:  string;
  name: string;
}

// ── Date helpers ──────────────────────────────────────────────

function toISO(d: Date) { return d.toISOString().slice(0, 10); }

function todayStr() { return toISO(new Date()); }
function weekStartStr() {
  const d   = new Date();
  const day = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - day);
  return toISO(d);
}

// ── Status config ──────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "",                label: "All Statuses"     },
  { value: "working",         label: "Working"          },
  { value: "on_break",        label: "On Break"         },
  { value: "completed",       label: "Completed"        },
  { value: "missed_checkout", label: "Missed Checkout"  },
];

const STATUS_STYLE: Record<string, { cls: string; label: string }> = {
  working:         { cls: "badge-green",  label: "Working"         },
  on_break:        { cls: "badge-yellow", label: "On Break"        },
  completed:       { cls: "badge-blue",   label: "Completed"       },
  missed_checkout: { cls: "badge-red",    label: "Missed Checkout" },
};

// ── Stat tile ──────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  count,
  label,
  iconCls,
  bgCls,
}: {
  icon: React.ElementType;
  count: number;
  label: string;
  iconCls: string;
  bgCls: string;
}) {
  return (
    <div className="card flex items-center gap-3 py-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${bgCls}`}>
        <Icon className={`h-4 w-4 ${iconCls}`} />
      </div>
      <div>
        <p className="text-xl font-bold tabular-nums text-slate-900">{count}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────

export default function AdminAttendancePage() {
  // Filters
  const [from,       setFrom]       = useState(weekStartStr());
  const [to,         setTo]         = useState(todayStr());
  const [userId,     setUserId]     = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Data
  const [sessions,   setSessions]   = useState<AttendanceSessionV2[]>([]);
  const [employees,  setEmployees]  = useState<EmployeeOption[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  // ── Load employee list for filter dropdown ──────────────────

  useEffect(() => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then((j) => {
        if (j.success && Array.isArray(j.data)) {
          setEmployees(
            j.data.map((u: { uid: string; displayName?: string; email?: string }) => ({
              uid:  u.uid,
              name: u.displayName ?? u.email ?? u.uid,
            }))
          );
        }
      })
      .catch(() => {/* silently ignore — filter still works without names */});
  }, []);

  // ── Fetch sessions ──────────────────────────────────────────

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ from, to, limit: "500" });
    if (userId)       params.set("userId", userId);
    if (statusFilter) params.set("status", statusFilter);

    try {
      const res  = await fetch(`/api/admin/attendance?${params}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error ?? `Server error ${res.status}`);
      } else {
        setSessions(Array.isArray(json.data) ? json.data : []);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [from, to, userId, statusFilter]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // ── Live stat counts (from fetched sessions) ────────────────

  const workingCount  = sessions.filter((s) => s.status === "working").length;
  const breakCount    = sessions.filter((s) => s.status === "on_break").length;
  const doneCount     = sessions.filter((s) => s.status === "completed").length;
  const missedCount   = sessions.filter((s) => s.status === "missed_checkout").length;

  // ── Period totals ───────────────────────────────────────────

  const totalWorkMin  = sessions.reduce((s, r) => s + (r.totalWorkMinutes  ?? 0), 0);
  const totalBreakMin = sessions.reduce((s, r) => s + (r.totalBreakMinutes ?? 0), 0);
  const totalOtMin    = sessions.reduce((s, r) => s + (r.overtimeMinutes   ?? 0), 0);

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Attendance</h1>
        <p className="mt-1 text-sm text-slate-500">
          View and filter all employee attendance sessions.
        </p>
      </div>

      {/* Stat tiles */}
      <div className="grid gap-3 sm:grid-cols-4">
        <StatTile icon={Clock}         count={workingCount} label="Working"          iconCls="text-green-600"  bgCls="bg-green-50"  />
        <StatTile icon={Coffee}        count={breakCount}   label="On Break"         iconCls="text-orange-600" bgCls="bg-orange-50" />
        <StatTile icon={CheckCircle2}  count={doneCount}    label="Completed"        iconCls="text-blue-600"   bgCls="bg-blue-50"   />
        <StatTile icon={AlertTriangle} count={missedCount}  label="Missed Checkout"  iconCls="text-red-600"    bgCls="bg-red-50"    />
      </div>

      {/* Filter bar */}
      <div className="card flex flex-wrap items-end gap-4">
        <SlidersHorizontal className="h-4 w-4 shrink-0 text-slate-400 self-center" />

        {/* Employee */}
        <div className="min-w-[160px] flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-600">Employee</label>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="input w-full text-sm"
          >
            <option value="">All Employees</option>
            {employees.map((e) => (
              <option key={e.uid} value={e.uid}>{e.name}</option>
            ))}
          </select>
        </div>

        {/* From */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">From</label>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="input text-sm"
          />
        </div>

        {/* To */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">To</label>
          <input
            type="date"
            value={to}
            min={from}
            max={todayStr()}
            onChange={(e) => setTo(e.target.value)}
            className="input text-sm"
          />
        </div>

        {/* Status */}
        <div className="min-w-[150px]">
          <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-full text-sm"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Sessions table */}
      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {[
                "Employee",
                "Date",
                "Clock In",
                "Clock Out",
                "Break",
                "Work Hours",
                "Overtime",
                "Status",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" />
                </td>
              </tr>
            ) : sessions.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                  No sessions found for the selected filters.
                </td>
              </tr>
            ) : (
              sessions.map((s) => {
                const style    = STATUS_STYLE[s.status] ?? { cls: "badge-gray", label: s.status };
                const clockIn  = s.clockInAt  ? formatISO(s.clockInAt)  : "—";
                const clockOut = s.clockOutAt ? formatISO(s.clockOutAt) : "—";
                const workMin  = s.totalWorkMinutes  ?? 0;
                const otMin    = s.overtimeMinutes   ?? 0;

                return (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">{s.userName}</td>
                    <td className="px-4 py-3 text-slate-600">{s.workDate}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{clockIn}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{clockOut}</td>
                    <td className="px-4 py-3 tabular-nums text-orange-700">
                      {minutesToReadable(s.totalBreakMinutes ?? 0)}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-medium text-blue-700">
                      {minutesToDecimal(workMin)}h
                    </td>
                    <td className={cn(
                      "px-4 py-3 tabular-nums font-medium",
                      otMin > 0 ? "text-purple-700" : "text-slate-400"
                    )}>
                      {otMin > 0 ? `${minutesToDecimal(otMin)}h` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={style.cls}>{style.label}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {/* Totals footer row */}
          {!loading && sessions.length > 0 && (
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Period Totals ({sessions.length} sessions)
                </td>
                <td className="px-4 py-3 tabular-nums font-semibold text-orange-700">
                  {minutesToReadable(totalBreakMin)}
                </td>
                <td className="px-4 py-3 tabular-nums font-bold text-blue-800">
                  {minutesToDecimal(totalWorkMin)}h
                </td>
                <td className="px-4 py-3 tabular-nums font-semibold text-purple-700">
                  {totalOtMin > 0 ? `${minutesToDecimal(totalOtMin)}h` : "—"}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
