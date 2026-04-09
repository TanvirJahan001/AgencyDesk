/**
 * components/payroll/WeeklySummaryCard.tsx
 *
 * Self-contained client component that fetches /api/payroll/weekly and
 * renders an earnings card with a per-day breakdown table.
 *
 * Usage:
 *   <WeeklySummaryCard />
 *
 * The userId is resolved server-side by the API (uses the session cookie).
 * Optionally pass an explicit weekStart (YYYY-MM-DD) to view other weeks.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ChevronLeft, ChevronRight, DollarSign } from "lucide-react";
import { minutesToReadable, minutesToDecimal } from "@/lib/attendance/utils";

// ── Types ──────────────────────────────────────────────────────

interface DayBreakdown {
  date:        string;
  workMinutes: number;
  regularMin:  number;
  overtimeMin: number;
  dailyPay:    number;
}

interface WeeklyData {
  weekStart:       string;
  weekEnd:         string;
  regularMinutes:  number;
  overtimeMinutes: number;
  regularPay:      number;
  overtimePay:     number;
  grossPay:        number;
  totalDays:       number;
  hourlyRate:      number;
  dailyBreakdown:  DayBreakdown[];
}

// ── Date helpers ───────────────────────────────────────────────

/** Get Monday of the week containing dateStr */
function getMondayOf(dateStr: string): string {
  const d   = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().slice(0, 10);
}

/** Add/subtract days from a YYYY-MM-DD date */
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Format a YYYY-MM-DD date for display */
function fmtDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "short",
    month:   "short",
    day:     "numeric",
    timeZone: "UTC",
  });
}

// ── Component ──────────────────────────────────────────────────

export default function WeeklySummaryCard() {
  const today = new Date().toISOString().slice(0, 10);

  const [weekStart, setWeekStart] = useState(getMondayOf(today));
  const [data,      setData]      = useState<WeeklyData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const currentMonday = getMondayOf(today);
  const isCurrentWeek = weekStart >= currentMonday;

  const fetchWeekly = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/payroll/weekly?weekStart=${weekStart}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error ?? `Server error ${res.status}`);
        return;
      }

      setData(json.data as WeeklyData);
    } catch {
      setError("Could not load weekly summary.");
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { fetchWeekly(); }, [fetchWeekly]);

  // Week navigation
  const prevWeek = () => setWeekStart(addDays(weekStart, -7));
  const nextWeek = () => { if (!isCurrentWeek) setWeekStart(addDays(weekStart, 7)); };

  // ── Loading ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  // ── Week range label ──────────────────────────────────────────

  const weekLabel = data
    ? `${fmtDate(data.weekStart)} — ${fmtDate(data.weekEnd ?? addDays(weekStart, 6))}`
    : `${fmtDate(weekStart)} — ${fmtDate(addDays(weekStart, 6))}`;

  // ── Empty state ───────────────────────────────────────────────

  const isEmpty = !data || (data.totalDays === 0 && data.grossPay === 0);

  return (
    <div className="space-y-4">
      {/* Week navigation bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevWeek}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Prev week
        </button>

        <span className="text-sm font-semibold text-slate-700 text-center">
          {isCurrentWeek ? (
            <span className="text-brand-700">This Week</span>
          ) : weekLabel}
        </span>

        <button
          onClick={nextWeek}
          disabled={isCurrentWeek}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Next week <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Main earnings card */}
      {isEmpty ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          No sessions recorded for this week.
        </div>
      ) : data && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          {/* Gross pay hero */}
          <div className="flex items-center gap-4 bg-gradient-to-r from-brand-600 to-brand-700 px-6 py-5 text-white">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium opacity-80">Week Earnings</p>
              <p className="text-3xl font-bold tabular-nums">${data.grossPay.toFixed(2)}</p>
            </div>
            <div className="ml-auto text-right text-sm opacity-80">
              <p>{minutesToReadable(data.regularMinutes + data.overtimeMinutes)} worked</p>
              <p>@ ${data.hourlyRate?.toFixed(2) ?? "—"}/hr</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
            <div className="px-5 py-4 text-center">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Regular</p>
              <p className="mt-1 text-lg font-bold text-slate-900">${data.regularPay.toFixed(2)}</p>
              <p className="text-xs text-slate-400">{minutesToReadable(data.regularMinutes)}</p>
            </div>
            <div className="px-5 py-4 text-center">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Overtime</p>
              <p className={`mt-1 text-lg font-bold ${data.overtimePay > 0 ? "text-orange-600" : "text-slate-400"}`}>
                ${data.overtimePay.toFixed(2)}
              </p>
              <p className="text-xs text-slate-400">{minutesToReadable(data.overtimeMinutes)}</p>
            </div>
            <div className="px-5 py-4 text-center">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Days</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{data.totalDays}</p>
              <p className="text-xs text-slate-400">worked</p>
            </div>
          </div>

          {/* Per-day breakdown toggle */}
          {data.dailyBreakdown && data.dailyBreakdown.length > 0 && (
            <>
              <button
                onClick={() => setShowBreakdown((v) => !v)}
                className="w-full px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hover:bg-slate-50 transition-colors flex items-center justify-between"
              >
                <span>Daily breakdown</span>
                <span className="text-slate-400">{showBreakdown ? "▲ Hide" : "▼ Show"}</span>
              </button>

              {showBreakdown && (
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {["Day", "Work", "Regular", "OT", "Pay"].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.dailyBreakdown.map((day) => (
                      <tr key={day.date} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-slate-700">
                          {fmtDate(day.date)}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-blue-700">
                          {minutesToDecimal(day.workMinutes)}h
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-slate-600">
                          {minutesToDecimal(day.regularMin)}h
                        </td>
                        <td className={`px-4 py-2.5 tabular-nums ${day.overtimeMin > 0 ? "text-orange-600 font-medium" : "text-slate-400"}`}>
                          {day.overtimeMin > 0 ? `${minutesToDecimal(day.overtimeMin)}h` : "—"}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums font-semibold text-slate-900">
                          ${day.dailyPay.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
