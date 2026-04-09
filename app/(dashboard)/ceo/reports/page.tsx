/**
 * app/(dashboard)/ceo/reports/page.tsx — CEO Reports
 *
 * Simple summary report cards that pull live data:
 *   - This week: attendance summary + payroll total
 *   - This month: attendance summary + payroll total
 *
 * Each card shows employee count, total hours, and gross pay.
 * CEO can see the data in-page; for full export, link to admin/reports.
 */

"use client";

import { useEffect, useState } from "react";
import { Loader2, FileBarChart, TrendingUp, Calendar } from "lucide-react";
import { minutesToDecimal, minutesToReadable } from "@/lib/attendance/utils";

// ── Types ──────────────────────────────────────────────────────

interface PayrollRow {
  userId:          string;
  name:            string;
  totalDays:       number;
  regularMinutes:  number;
  overtimeMinutes: number;
  grossPay:        number;
}

interface PeriodSummary {
  employeeCount: number;
  totalDays:     number;
  totalWorkMin:  number;
  totalOtMin:    number;
  totalGross:    number;
  rows:          PayrollRow[];
}

// ── Date helpers ──────────────────────────────────────────────

function currentWeekMonday(): string {
  const d   = new Date();
  const day = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ── Data fetch ─────────────────────────────────────────────────

async function fetchPeriodData(params: string): Promise<PeriodSummary> {
  const res  = await fetch(`/api/admin/payroll${params}`);
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to load");

  const rows: PayrollRow[] = Array.isArray(json.data) ? json.data : [];

  return {
    employeeCount: rows.length,
    totalDays:     rows.reduce((s, r) => s + r.totalDays,      0),
    totalWorkMin:  rows.reduce((s, r) => s + r.regularMinutes + r.overtimeMinutes, 0),
    totalOtMin:    rows.reduce((s, r) => s + r.overtimeMinutes, 0),
    totalGross:    rows.reduce((s, r) => s + r.grossPay,        0),
    rows,
  };
}

// ── Summary card ───────────────────────────────────────────────

function SummaryCard({
  title,
  icon: Icon,
  iconCls,
  bgCls,
  summary,
  loading,
  error,
}: {
  title:   string;
  icon:    React.ElementType;
  iconCls: string;
  bgCls:   string;
  summary: PeriodSummary | null;
  loading: boolean;
  error:   string | null;
}) {
  return (
    <div className="card space-y-4">
      {/* Card header */}
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${bgCls}`}>
          <Icon className={`h-4 w-4 ${iconCls}`} />
        </div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      ) : !summary || summary.employeeCount === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
          No data for this period.
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Employees</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{summary.employeeCount}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Days Worked</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{summary.totalDays}</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3 text-center">
              <p className="text-xs text-blue-600 uppercase tracking-wide">Total Hours</p>
              <p className="mt-1 text-xl font-bold text-blue-900">
                {minutesToDecimal(summary.totalWorkMin)}h
              </p>
              <p className="text-xs text-blue-400">{minutesToReadable(summary.totalWorkMin)}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3 text-center">
              <p className="text-xs text-emerald-600 uppercase tracking-wide">Gross Pay</p>
              <p className="mt-1 text-xl font-bold text-emerald-900">
                ${summary.totalGross.toFixed(2)}
              </p>
              {summary.totalOtMin > 0 && (
                <p className="text-xs text-orange-500">
                  incl. {minutesToDecimal(summary.totalOtMin)}h OT
                </p>
              )}
            </div>
          </div>

          {/* Per-employee rows */}
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-100">
            {summary.rows.map((r) => (
              <div key={r.userId} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="font-medium text-slate-800">{r.name}</span>
                <div className="flex items-center gap-4 text-right">
                  <span className="tabular-nums text-blue-700">
                    {minutesToDecimal(r.regularMinutes + r.overtimeMinutes)}h
                  </span>
                  <span className="tabular-nums font-semibold text-slate-900 w-20">
                    ${r.grossPay.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function CEOReportsPage() {
  const [weekData,  setWeekData]  = useState<PeriodSummary | null>(null);
  const [monthData, setMonthData] = useState<PeriodSummary | null>(null);
  const [weekLoad,  setWeekLoad]  = useState(true);
  const [monthLoad, setMonthLoad] = useState(true);
  const [weekErr,   setWeekErr]   = useState<string | null>(null);
  const [monthErr,  setMonthErr]  = useState<string | null>(null);

  const monday = currentWeekMonday();
  const month  = currentMonth();

  useEffect(() => {
    // Weekly
    fetchPeriodData(`?type=weekly&weekStart=${monday}`)
      .then(setWeekData)
      .catch((e) => setWeekErr(e.message))
      .finally(() => setWeekLoad(false));

    // Monthly
    fetchPeriodData(`?type=monthly&month=${month}`)
      .then(setMonthData)
      .catch((e) => setMonthErr(e.message))
      .finally(() => setMonthLoad(false));
  }, [monday, month]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
          <FileBarChart className="h-5 w-5 text-slate-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500">
            Live payroll summary for the current week and month.
          </p>
        </div>
      </div>

      {/* Side-by-side summary cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SummaryCard
          title={`This Week`}
          icon={TrendingUp}
          iconCls="text-brand-600"
          bgCls="bg-brand-50"
          summary={weekData}
          loading={weekLoad}
          error={weekErr}
        />
        <SummaryCard
          title={`${monthLabel(month)}`}
          icon={Calendar}
          iconCls="text-emerald-600"
          bgCls="bg-emerald-50"
          summary={monthData}
          loading={monthLoad}
          error={monthErr}
        />
      </div>
    </div>
  );
}
