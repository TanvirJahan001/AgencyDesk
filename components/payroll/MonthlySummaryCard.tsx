/**
 * components/payroll/MonthlySummaryCard.tsx
 *
 * Self-contained client component that fetches /api/payroll/monthly
 * and renders a monthly earnings card with a per-day breakdown table.
 *
 * Usage:
 *   <MonthlySummaryCard />
 *
 * The userId is resolved server-side by the API (uses the session cookie).
 * A month navigator lets the user browse previous months.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import { minutesToReadable, minutesToDecimal } from "@/lib/attendance/utils";

// ── Types ──────────────────────────────────────────────────────

interface DayBreakdown {
  date:        string;
  workMinutes: number;
  regularMin:  number;
  overtimeMin: number;
  dailyPay:    number;
}

interface MonthlyData {
  month:           string;   // YYYY-MM
  monthStart:      string;
  monthEnd:        string;
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

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year:  "numeric",
  });
}

function fmtDay(dateStr: string): string {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "short",
    month:   "short",
    day:     "numeric",
    timeZone: "UTC",
  });
}

// ── Component ──────────────────────────────────────────────────

export default function MonthlySummaryCard() {
  const [month,   setMonth]   = useState(currentMonth());
  const [data,    setData]    = useState<MonthlyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const isCurrent = month >= currentMonth();

  const fetchMonthly = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/payroll/monthly?month=${month}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error ?? `Server error ${res.status}`);
        return;
      }

      setData(json.data as MonthlyData);
    } catch {
      setError("Could not load monthly summary.");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { fetchMonthly(); }, [fetchMonthly]);

  // ── Loading ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  const isEmpty = !data || (data.totalDays === 0 && data.grossPay === 0);

  return (
    <div className="space-y-4">
      {/* Month navigation bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setMonth(prevMonth(month))}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </button>

        <span className="text-sm font-semibold text-slate-700">
          {isCurrent
            ? <span className="text-brand-700">{monthLabel(month)}</span>
            : monthLabel(month)}
        </span>

        <button
          onClick={() => { if (!isCurrent) setMonth(nextMonth(month)); }}
          disabled={isCurrent}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Main card */}
      {isEmpty ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          No sessions recorded for {monthLabel(month)}.
        </div>
      ) : data && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          {/* Gross pay hero */}
          <div className="flex items-center gap-4 bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-5 text-white">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium opacity-80">Monthly Earnings</p>
              <p className="text-3xl font-bold tabular-nums">${data.grossPay.toFixed(2)}</p>
            </div>
            <div className="ml-auto text-right text-sm opacity-80">
              <p>{minutesToReadable(data.regularMinutes + data.overtimeMinutes)} worked</p>
              <p>@ ${data.hourlyRate?.toFixed(2) ?? "—"}/hr</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
            <div className="px-4 py-4 text-center">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Days</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{data.totalDays}</p>
              <p className="text-xs text-slate-400">worked</p>
            </div>
            <div className="px-4 py-4 text-center">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Hours</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {minutesToDecimal(data.regularMinutes + data.overtimeMinutes)}
              </p>
              <p className="text-xs text-slate-400">total</p>
            </div>
            <div className="px-4 py-4 text-center">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Regular</p>
              <p className="mt-1 text-lg font-bold text-blue-700">
                ${data.regularPay.toFixed(2)}
              </p>
              <p className="text-xs text-slate-400">{minutesToDecimal(data.regularMinutes)}h</p>
            </div>
            <div className="px-4 py-4 text-center">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Overtime</p>
              <p className={`mt-1 text-lg font-bold ${data.overtimePay > 0 ? "text-orange-600" : "text-slate-400"}`}>
                ${data.overtimePay.toFixed(2)}
              </p>
              <p className="text-xs text-slate-400">{minutesToDecimal(data.overtimeMinutes)}h</p>
            </div>
          </div>

          {/* Per-day breakdown toggle */}
          {data.dailyBreakdown && data.dailyBreakdown.filter((d) => d.workMinutes > 0).length > 0 && (
            <>
              <button
                onClick={() => setShowBreakdown((v) => !v)}
                className="w-full px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hover:bg-slate-50 transition-colors flex items-center justify-between"
              >
                <span>Daily breakdown ({data.totalDays} days)</span>
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
                    {data.dailyBreakdown
                      .filter((day) => day.workMinutes > 0)
                      .map((day) => (
                        <tr key={day.date} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-medium text-slate-700">
                            {fmtDay(day.date)}
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
