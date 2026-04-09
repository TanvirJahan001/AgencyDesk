/**
 * components/timesheets/TimesheetGenerator.tsx
 *
 * Lets the employee pick a week (or month) and generate a timesheet
 * from their attendance sessions.
 */

"use client";

import { useState } from "react";
import type { TimesheetPeriodType } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  onGenerate: (periodType: TimesheetPeriodType, date: string) => Promise<unknown>;
  generating?: boolean;
}

export default function TimesheetGenerator({ onGenerate, generating }: Props) {
  const [periodType, setPeriodType] = useState<TimesheetPeriodType>("weekly");
  const [date, setDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });

  function handleGenerate() {
    if (!date) return;
    onGenerate(periodType, date);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-gray-900">
        Generate Timesheet
      </h3>

      <div className="flex flex-wrap items-end gap-4">
        {/* Period type toggle */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-600">
            Period
          </label>
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={() => setPeriodType("weekly")}
              className={cn(
                "rounded-l-lg px-4 py-2 text-sm font-medium transition-colors",
                periodType === "weekly"
                  ? "bg-brand-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              Weekly
            </button>
            <button
              type="button"
              onClick={() => setPeriodType("monthly")}
              className={cn(
                "rounded-r-lg px-4 py-2 text-sm font-medium transition-colors",
                periodType === "monthly"
                  ? "bg-brand-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              Monthly
            </button>
          </div>
        </div>

        {/* Date picker */}
        <div>
          <label htmlFor="ts-date" className="mb-1.5 block text-xs font-medium text-gray-600">
            {periodType === "weekly" ? "Any date in the week" : "Any date in the month"}
          </label>
          <input
            id="ts-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || !date}
          className={cn(
            "rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white transition-colors",
            "hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {generating ? "Generating…" : "Generate"}
        </button>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        {periodType === "weekly"
          ? "Generates a Mon–Sun timesheet for the selected week."
          : "Generates a timesheet for the entire selected month."}
      </p>
    </div>
  );
}
