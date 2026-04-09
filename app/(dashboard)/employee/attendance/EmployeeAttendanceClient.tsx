/**
 * app/(dashboard)/employee/attendance/EmployeeAttendanceClient.tsx
 *
 * Full attendance history with date-range filters and totals summary.
 * Supports quick presets (This Week, This Month, Last Month, Last 3 Months)
 * and a custom date-range picker.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import type { AttendanceSessionV2 } from "@/types";
import { minutesToReadable, formatISO } from "@/lib/attendance/utils";
import CorrectionRequestForm from "@/components/corrections/CorrectionRequestForm";
import { Loader2, Edit3, Calendar, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Date helpers ──────────────────────────────────────────────

function toLocalISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function thisWeek(): { from: string; to: string } {
  const now    = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return { from: toLocalISO(monday), to: toLocalISO(now) };
}

function thisMonth(): { from: string; to: string } {
  const now = new Date();
  return {
    from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
    to:   toLocalISO(now),
  };
}

function lastMonth(): { from: string; to: string } {
  const now  = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last  = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: toLocalISO(first), to: toLocalISO(last) };
}

function last3Months(): { from: string; to: string } {
  const now  = new Date();
  const from = new Date(now);
  from.setMonth(from.getMonth() - 3);
  return { from: toLocalISO(from), to: toLocalISO(now) };
}

// ── Preset config ─────────────────────────────────────────────

type Preset = "week" | "month" | "last-month" | "3months" | "custom";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "week",       label: "This Week"     },
  { id: "month",      label: "This Month"    },
  { id: "last-month", label: "Last Month"    },
  { id: "3months",    label: "Last 3 Months" },
  { id: "custom",     label: "Custom Range"  },
];

function rangeForPreset(p: Preset, customFrom: string, customTo: string) {
  switch (p) {
    case "week":       return thisWeek();
    case "month":      return thisMonth();
    case "last-month": return lastMonth();
    case "3months":    return last3Months();
    case "custom":     return { from: customFrom, to: customTo };
  }
}

// ── Status display config ─────────────────────────────────────

const STATUS_STYLE: Record<string, { cls: string; label: string }> = {
  working:         { cls: "badge-green",  label: "Working"         },
  on_break:        { cls: "badge-yellow", label: "On Break"        },
  completed:       { cls: "badge-blue",   label: "Completed"       },
  missed_checkout: { cls: "badge-red",    label: "Missed Checkout" },
};

// ── Totals helper ─────────────────────────────────────────────

function computeTotals(sessions: AttendanceSessionV2[]) {
  let workMin  = 0;
  let breakMin = 0;
  const days   = new Set<string>();
  for (const s of sessions) {
    workMin  += s.totalWorkMinutes  ?? 0;
    breakMin += s.totalBreakMinutes ?? 0;
    days.add(s.workDate);
  }
  return { workMin, breakMin, days: days.size };
}

// ── Component ─────────────────────────────────────────────────

export default function EmployeeAttendanceClient() {
  const [preset,       setPreset]       = useState<Preset>("month");
  const [customFrom,   setCustomFrom]   = useState(toLocalISO(new Date()));
  const [customTo,     setCustomTo]     = useState(toLocalISO(new Date()));
  const [showCustom,   setShowCustom]   = useState(false);

  const [sessions,      setSessions]      = useState<AttendanceSessionV2[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [fetchError,    setFetchError]    = useState<string | null>(null);
  const [correctionFor, setCorrectionFor] = useState<AttendanceSessionV2 | null>(null);

  // ── Fetch ─────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    const { from, to } = rangeForPreset(preset, customFrom, customTo);
    if (!from || !to) { setLoading(false); return; }

    try {
      const res  = await fetch(`/api/attendance/history?from=${from}&to=${to}&limit=200`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        setFetchError(json.error ?? `Server error ${res.status}`);
      } else {
        // API returns ok<AttendanceSessionV2[]>(sessions) → { success: true, data: [...] }
        setSessions(Array.isArray(json.data) ? json.data : []);
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setLoading(false);
    }
  }, [preset, customFrom, customTo]);

  useEffect(() => {
    if (preset === "custom" && (!customFrom || !customTo || customFrom > customTo)) return;
    fetchHistory();
  }, [fetchHistory, preset, customFrom, customTo]);

  const totals = computeTotals(sessions);

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Attendance History</h1>
        <p className="mt-1 text-sm text-slate-500">
          View your past sessions and request corrections for completed days.
        </p>
      </div>

      {/* Preset filter chips */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setPreset(p.id);
              setShowCustom(p.id === "custom");
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
              preset === p.id
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            )}
          >
            {p.id === "custom" && <ChevronDown className="h-3 w-3" />}
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date range picker */}
      {preset === "custom" && showCustom && (
        <div className="card flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">From</label>
            <input
              type="date"
              value={customFrom}
              max={customTo}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="input text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">To</label>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              max={toLocalISO(new Date())}
              onChange={(e) => setCustomTo(e.target.value)}
              className="input text-sm"
            />
          </div>
          <button
            onClick={fetchHistory}
            className="btn-primary flex items-center gap-1.5 text-sm"
          >
            <Calendar className="h-4 w-4" />
            Apply
          </button>
        </div>
      )}

      {/* Summary cards — shown above table when data exists */}
      {!loading && sessions.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Days Worked
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{totals.days}</p>
          </div>
          <div className="card py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total Work
            </p>
            <p className="mt-1 text-2xl font-bold text-blue-700">
              {minutesToReadable(totals.workMin)}
            </p>
          </div>
          <div className="card py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total Break
            </p>
            <p className="mt-1 text-2xl font-bold text-orange-600">
              {minutesToReadable(totals.breakMin)}
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {fetchError}
        </div>
      )}

      {/* Sessions table */}
      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {["Date", "Clock In", "Clock Out", "Work", "Break", "Status", ""].map((h) => (
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
                <td colSpan={7} className="px-4 py-12 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" />
                </td>
              </tr>
            ) : sessions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                  No sessions found for the selected period.
                </td>
              </tr>
            ) : (
              sessions.map((s) => {
                const style    = STATUS_STYLE[s.status] ?? { cls: "badge-gray", label: s.status };
                const clockIn  = formatISO(s.clockInAt);
                const clockOut = s.clockOutAt ? formatISO(s.clockOutAt) : "—";

                return (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {s.workDate}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{clockIn}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{clockOut}</td>
                    <td className="px-4 py-3 tabular-nums font-medium text-blue-700">
                      {minutesToReadable(s.totalWorkMinutes)}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-medium text-orange-700">
                      {minutesToReadable(s.totalBreakMinutes)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={style.cls}>{style.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      {s.status === "completed" && (
                        <button
                          onClick={() => setCorrectionFor(s)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
                            "bg-blue-50 text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100 transition-colors"
                          )}
                        >
                          <Edit3 className="h-3 w-3" />
                          Request Correction
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Row count footer */}
        {!loading && sessions.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-400">
            Showing {sessions.length} session{sessions.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Correction form modal */}
      {correctionFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <CorrectionRequestForm
              session={correctionFor}
              onSuccess={() => {
                setCorrectionFor(null);
                fetchHistory();
              }}
              onClose={() => setCorrectionFor(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
