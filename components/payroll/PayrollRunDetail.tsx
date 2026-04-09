/**
 * components/payroll/PayrollRunDetail.tsx
 *
 * Expandable detail view of a single payroll run showing:
 *  - Rate config, regular vs OT breakdown, pay summary
 *  - Day-by-day work table
 */

"use client";

import type { PayrollRun } from "@/types";
import {
  fmtCurrency,
  fmtRate,
  minToReadable,
  minToHours,
} from "@/lib/payroll/utils";
import { cn } from "@/lib/utils";

interface Props {
  run: PayrollRun;
}

export default function PayrollRunDetail({ run }: Props) {
  return (
    <div className="space-y-4">
      {/* ── Summary grid ───────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniCard label="Hourly Rate" value={fmtRate(run.hourlyRate)} />
        <MiniCard label="OT Multiplier" value={`${run.overtimeMultiplier}x`} />
        <MiniCard label="OT Threshold" value={`${minToHours(run.weeklyOtThresholdMin)}h/wk`} />
        <MiniCard label="Total Work" value={minToReadable(run.totalWorkMin)} />
      </div>

      {/* ── Pay breakdown ──────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="px-4 py-2.5 text-left font-medium text-gray-600">Category</th>
              <th className="px-4 py-2.5 text-right font-medium text-gray-600">Time</th>
              <th className="px-4 py-2.5 text-right font-medium text-gray-600">Rate</th>
              <th className="px-4 py-2.5 text-right font-medium text-gray-600">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-50">
              <td className="px-4 py-2.5 text-gray-700">Regular</td>
              <td className="px-4 py-2.5 text-right font-mono text-gray-700">
                {minToReadable(run.regularMin)} ({minToHours(run.regularMin)}h)
              </td>
              <td className="px-4 py-2.5 text-right text-gray-500">
                {fmtCurrency(run.hourlyRate)}/hr
              </td>
              <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                {fmtCurrency(run.regularPay)}
              </td>
            </tr>
            <tr className="border-b border-gray-50">
              <td className="px-4 py-2.5 text-gray-700">
                Overtime
                <span className="ml-1 text-xs text-gray-400">({run.overtimeMultiplier}x)</span>
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-gray-700">
                {minToReadable(run.overtimeMin)} ({minToHours(run.overtimeMin)}h)
              </td>
              <td className="px-4 py-2.5 text-right text-gray-500">
                {fmtCurrency(run.hourlyRate * run.overtimeMultiplier)}/hr
              </td>
              <td className="px-4 py-2.5 text-right font-semibold text-orange-600">
                {fmtCurrency(run.overtimePay)}
              </td>
            </tr>
            <tr className="border-b border-gray-100 bg-gray-50/40">
              <td className="px-4 py-2.5 font-semibold text-gray-900" colSpan={3}>
                Gross Pay
              </td>
              <td className="px-4 py-2.5 text-right font-bold text-gray-900">
                {fmtCurrency(run.grossPay)}
              </td>
            </tr>
            {run.deductions > 0 && (
              <tr className="border-b border-gray-50">
                <td className="px-4 py-2.5 text-red-600" colSpan={3}>
                  Deductions
                </td>
                <td className="px-4 py-2.5 text-right text-red-600">
                  -{fmtCurrency(run.deductions)}
                </td>
              </tr>
            )}
            <tr className="bg-brand-50/40">
              <td className="px-4 py-3 font-bold text-brand-800" colSpan={3}>
                Net Pay
              </td>
              <td className="px-4 py-3 text-right font-bold text-lg text-brand-700">
                {fmtCurrency(run.netPay)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Daily breakdown ─────────────────────────────────── */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900">
          Day-by-day breakdown ({run.dailyBreakdown.filter((d) => d.workMin > 0).length} days worked)
        </summary>
        <div className="mt-2 rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="px-4 py-2 text-left font-medium text-gray-600">Date</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">Work</th>
                <th className="px-4 py-2 text-center font-medium text-gray-600">Sessions</th>
              </tr>
            </thead>
            <tbody>
              {run.dailyBreakdown.map((day) => (
                <tr
                  key={day.date}
                  className={cn(
                    "border-b border-gray-50",
                    day.workMin === 0 && "text-gray-400 bg-gray-50/30"
                  )}
                >
                  <td className="px-4 py-1.5">{day.date}</td>
                  <td className="px-4 py-1.5 text-right font-mono text-xs">
                    {day.workMin > 0 ? minToReadable(day.workMin) : "—"}
                  </td>
                  <td className="px-4 py-1.5 text-center text-xs">
                    {day.sessionIds.length || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}
