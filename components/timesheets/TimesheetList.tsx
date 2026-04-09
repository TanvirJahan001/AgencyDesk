/**
 * components/timesheets/TimesheetList.tsx
 *
 * Displays the employee's list of timesheets with expandable weekly views.
 */

"use client";

import { useState } from "react";
import type { Timesheet } from "@/types";
import { msToDecimalHours } from "@/lib/attendance/utils";
import { formatWeekDisplay, formatMonthDisplay } from "@/lib/timesheets/utils";
import TimesheetWeeklyView from "./TimesheetWeeklyView";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  timesheets: Timesheet[];
  onSubmit: (timesheetId: string) => Promise<boolean>;
}

const STATUS_DOT: Record<string, string> = {
  draft: "bg-gray-400",
  submitted: "bg-blue-500",
  approved: "bg-green-500",
  rejected: "bg-red-500",
};

export default function TimesheetList({ timesheets, onSubmit }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  if (timesheets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12 text-center text-sm text-gray-500">
        No timesheets yet. Generate one using the form above.
      </div>
    );
  }

  async function handleSubmit(id: string) {
    setSubmittingId(id);
    await onSubmit(id);
    setSubmittingId(null);
  }

  return (
    <div className="space-y-3">
      {timesheets.map((ts) => {
        const isExpanded = expandedId === ts.id;
        const periodDisplay =
          ts.periodType === "weekly"
            ? formatWeekDisplay(ts.periodStart, ts.periodEnd)
            : formatMonthDisplay(ts.periodLabel);

        return (
          <div key={ts.id}>
            {/* Summary row */}
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : ts.id)}
              className={cn(
                "flex w-full items-center gap-4 rounded-xl border bg-white px-5 py-4 text-left transition-colors",
                isExpanded
                  ? "border-brand-200 ring-1 ring-brand-100"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
              )}

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">{ts.periodLabel}</p>
                <p className="text-xs text-gray-500">{periodDisplay}</p>
              </div>

              <div className="text-right">
                <p className="text-sm font-mono font-semibold text-gray-900">
                  {msToDecimalHours(ts.totalWorkMs)}h
                </p>
                <p className="text-xs text-gray-500">
                  {ts.totalDaysWorked} day{ts.totalDaysWorked !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[ts.status])} />
                <span className="text-xs font-medium capitalize text-gray-600">
                  {ts.status}
                </span>
              </div>

              {ts.locked && (
                <span className="rounded bg-gray-800 px-2 py-0.5 text-[10px] font-semibold text-white">
                  LOCKED
                </span>
              )}
            </button>

            {/* Expanded weekly view */}
            {isExpanded && (
              <div className="mt-2 ml-4">
                <TimesheetWeeklyView
                  timesheet={ts}
                  onSubmit={() => handleSubmit(ts.id)}
                  submitting={submittingId === ts.id}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
