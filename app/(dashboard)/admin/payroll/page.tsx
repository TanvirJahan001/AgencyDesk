/**
 * app/(dashboard)/admin/payroll/page.tsx — Admin Payroll Page
 *
 * Two tabs:
 *   Weekly  — All employees for a chosen week. Totals at bottom.
 *   Monthly — All employees for a chosen month. Totals at bottom.
 *
 * Columns: Employee, Rate, Days, Regular Hours, OT Hours, Regular Pay, OT Pay, Gross Pay
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, DollarSign, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { minutesToDecimal, minutesToReadable } from "@/lib/attendance/utils";

// ── Types ──────────────────────────────────────────────────────

interface PayrollRow {
  userId:              string;
  name:                string;
  hourlyRate:          number;
  overtimeMultiplier:  number;
  totalDays:           number;
  regularMinutes:      number;
  overtimeMinutes:     number;
  regularPay:          number;
  overtimePay:         number;
  grossPay:            number;
}

// ── Date helpers ──────────────────────────────────────────────

function getMondayOf(dateStr: string): string {
  const d   = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function currentWeekMonday(): string {
  return getMondayOf(new Date().toISOString().slice(0, 10));
}

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

function weekLabel(mondayStr: string): string {
  const end = addDays(mondayStr, 6);
  const fmt = (s: string) =>
    new Date(s + "T00:00:00Z").toLocaleDateString("en-US", {
      month: "short", day: "numeric", timeZone: "UTC",
    });
  return `${fmt(mondayStr)} – ${fmt(end)}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ── Payroll table ──────────────────────────────────────────────

function PayrollTable({ rows, loading, error }: {
  rows:    PayrollRow[];
  loading: boolean;
  error:   string | null;
}) {
  const totRegMin  = rows.reduce((s, r) => s + r.regularMinutes,  0);
  const totOtMin   = rows.reduce((s, r) => s + r.overtimeMinutes, 0);
  const totRegPay  = rows.reduce((s, r) => s + r.regularPay,      0);
  const totOtPay   = rows.reduce((s, r) => s + r.overtimePay,     0);
  const totGross   = rows.reduce((s, r) => s + r.grossPay,        0);

  return (
    <div className="card overflow-x-auto p-0">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {[
              "Employee",
              "Rate / hr",
              "Days",
              "Regular Hrs",
              "OT Hrs",
              "Regular Pay",
              "OT Pay",
              "Gross Pay",
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
          ) : error ? (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-sm text-red-600">
                {error}
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                No payroll data for this period.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.userId} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-900">{r.name}</td>
                <td className="px-4 py-3 tabular-nums text-slate-600">
                  ${r.hourlyRate.toFixed(2)}
                  {r.overtimeMultiplier !== 1.5 && (
                    <span className="ml-1 text-xs text-slate-400">
                      ×{r.overtimeMultiplier} OT
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-700">{r.totalDays}</td>
                <td className="px-4 py-3 tabular-nums text-blue-700">
                  {minutesToDecimal(r.regularMinutes)}h
                  <span className="ml-1 text-xs text-blue-400">
                    ({minutesToReadable(r.regularMinutes)})
                  </span>
                </td>
                <td className={cn(
                  "px-4 py-3 tabular-nums font-medium",
                  r.overtimeMinutes > 0 ? "text-orange-700" : "text-slate-300"
                )}>
                  {r.overtimeMinutes > 0 ? `${minutesToDecimal(r.overtimeMinutes)}h` : "—"}
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-700">
                  ${r.regularPay.toFixed(2)}
                </td>
                <td className={cn(
                  "px-4 py-3 tabular-nums",
                  r.overtimePay > 0 ? "text-orange-700 font-medium" : "text-slate-300"
                )}>
                  {r.overtimePay > 0 ? `$${r.overtimePay.toFixed(2)}` : "—"}
                </td>
                <td className="px-4 py-3 tabular-nums font-bold text-slate-900">
                  ${r.grossPay.toFixed(2)}
                </td>
              </tr>
            ))
          )}
        </tbody>

        {/* Totals */}
        {!loading && !error && rows.length > 0 && (
          <tfoot className="border-t-2 border-slate-200 bg-slate-50">
            <tr>
              <td colSpan={3} className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                Total ({rows.length} employees)
              </td>
              <td className="px-4 py-3 tabular-nums font-bold text-blue-800">
                {minutesToDecimal(totRegMin)}h
              </td>
              <td className="px-4 py-3 tabular-nums font-bold text-orange-700">
                {totOtMin > 0 ? `${minutesToDecimal(totOtMin)}h` : "—"}
              </td>
              <td className="px-4 py-3 tabular-nums font-bold text-slate-700">
                ${totRegPay.toFixed(2)}
              </td>
              <td className="px-4 py-3 tabular-nums font-bold text-orange-700">
                {totOtPay > 0 ? `$${totOtPay.toFixed(2)}` : "—"}
              </td>
              <td className="px-4 py-3 tabular-nums text-lg font-extrabold text-slate-900">
                ${totGross.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ── Weekly tab ─────────────────────────────────────────────────

function WeeklyTab() {
  const today         = new Date().toISOString().slice(0, 10);
  const currentMonday = getMondayOf(today);

  const [weekStart,   setWeekStart]   = useState(currentMonday);
  const [rows,        setRows]        = useState<PayrollRow[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  const isCurrentWeek = weekStart >= currentMonday;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/admin/payroll?type=weekly&weekStart=${weekStart}`);
      const json = await res.json();
      if (!res.ok || !json.success) { setError(json.error ?? "Failed to load"); return; }
      setRows(Array.isArray(json.data) ? json.data : []);
    } catch { setError("Network error."); }
    finally  { setLoading(false); }
  }, [weekStart]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-4">
      {/* Week navigator */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setWeekStart(addDays(weekStart, -7))}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </button>
        <span className="text-sm font-semibold text-slate-700">
          {isCurrentWeek
            ? <span className="text-brand-700">This week</span>
            : weekLabel(weekStart)}
        </span>
        <button
          onClick={() => { if (!isCurrentWeek) setWeekStart(addDays(weekStart, 7)); }}
          disabled={isCurrentWeek}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
        <span className="ml-2 text-xs text-slate-400">{weekLabel(weekStart)}</span>
      </div>

      <PayrollTable rows={rows} loading={loading} error={error} />
    </div>
  );
}

// ── Monthly tab ────────────────────────────────────────────────

function MonthlyTab() {
  const [month,   setMonth]   = useState(currentMonth());
  const [rows,    setRows]    = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const isCurrent = month >= currentMonth();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/admin/payroll?type=monthly&month=${month}`);
      const json = await res.json();
      if (!res.ok || !json.success) { setError(json.error ?? "Failed to load"); return; }
      setRows(Array.isArray(json.data) ? json.data : []);
    } catch { setError("Network error."); }
    finally  { setLoading(false); }
  }, [month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-4">
      {/* Month navigator */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMonth(prevMonth(month))}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
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
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <PayrollTable rows={rows} loading={loading} error={error} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

type Tab = "weekly" | "monthly";

export default function AdminPayrollPage() {
  const [tab, setTab] = useState<Tab>("weekly");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
          <DollarSign className="h-5 w-5 text-brand-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Payroll</h1>
          <p className="text-sm text-slate-500">
            Weekly and monthly earnings for all employees.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 w-fit">
        {(["weekly", "monthly"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-lg px-5 py-2 text-sm font-semibold capitalize transition-all",
              tab === t
                ? "bg-white shadow text-slate-900"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "weekly"  && <WeeklyTab />}
      {tab === "monthly" && <MonthlyTab />}
    </div>
  );
}
