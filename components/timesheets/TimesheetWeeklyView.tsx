/**
 * components/timesheets/TimesheetWeeklyView.tsx
 *
 * Displays a single weekly timesheet as a day-by-day table
 * with work/break hours and a summary row.
 */

"use client";

import type { Timesheet } from "@/types";
import { msToDecimalHours, msToReadable } from "@/lib/attendance/utils";
import { formatWeekDisplay } from "@/lib/timesheets/utils";
import { cn } from "@/lib/utils";

interface Props {
  timesheet: Timesheet;
  onSubmit?: () => void;
  submitting?: boolean;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function statusBadge(status: string) {
  const map: Record<string, { bg: string; text: string }> = {
    draft:     { bg: "bg-gray-100 text-gray-700", text: "Draft" },
    submitted: { bg: "bg-blue-100 text-blue-700", text: "Submitted" },
    approved:  { bg: "bg-green-100 text-green-700", text: "Approved" },
    rejected:  { bg: "bg-red-100 text-red-700", text: "Rejected" },
  };
  const s = map[status] || map.draft;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", s.bg)}>
      {s.text}
    </span>
  );
}

export default function TimesheetWeeklyView({ timesheet, onSubmit, submitting }: Props) {
  const { days, totalWorkMs, totalBreakMs, totalDaysWorked, status, locked } = timesheet;

  const canSubmit = (status === "draft" || status === "rejected") && !locked && totalDaysWorked > 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            {timesheet.periodLabel}
          </h3>
          <p className="text-xs text-gray-500">
            {formatWeekDisplay(timesheet.periodStart, timesheet.periodEnd)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {locked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-800 px-2.5 py-0.5 text-xs font-medium text-white">
              Locked
            </span>
          )}
          {statusBadge(status)}
        </div>
      </div>

      {/* Day-by-day table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60 text-left">
              <th className="px-5 py-2.5 font-medium text-gray-600">Day</th>
              <th className="px-5 py-2.5 font-medium text-gray-600">Date</th>
              <th className="px-5 py-2.5 font-medium text-gray-600 text-right">Work</th>
              <th className="px-5 py-2.5 font-medium text-gray-600 text-right">Break</th>
              <th className="px-5 py-2.5 font-medium text-gray-600 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day, i) => {
              const isAbsent = day.status === "absent";
              return (
                <tr
                  key={day.date}
                  className={cn(
                    "border-b border-gray-50 transition-colors",
                    isAbsent ? "bg-gray-50/40 text-gray-400" : "hover:bg-blue-50/30"
                  )}
                >
                  <td className="px-5 py-2.5 font-medium">
                    {DAY_NAMES[i] || ""}
                  </td>
                  <td className="px-5 py-2.5">{day.date}</td>
                  <td className="px-5 py-2.5 text-right font-mono text-xs">
                    {isAbsent ? "—" : msToReadable(day.totalWorkMs)}
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono text-xs">
                    {isAbsent ? "—" : msToReadable(day.totalBreakMs)}
                  </td>
                  <td className="px-5 py-2.5 text-center">
                    {isAbsent ? (
                      <span className="text-xs text-gray-400">Absent</span>
                    ) : (
                      <span className="inline-block h-2 w-2 rounded-full bg-green-500" title="Completed" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 font-semibold">
              <td className="px-5 py-3" colSpan={2}>
                Total ({totalDaysWorked} day{totalDaysWorked !== 1 ? "s" : ""})
              </td>
              <td className="px-5 py-3 text-right font-mono text-xs">
                {msToReadable(totalWorkMs)} ({msToDecimalHours(totalWorkMs)}h)
              </td>
              <td className="px-5 py-3 text-right font-mono text-xs">
                {msToReadable(totalBreakMs)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Review note */}
      {timesheet.reviewNote && (
        <div className={cn(
          "mx-5 my-3 rounded-lg border px-4 py-3 text-sm",
          status === "rejected"
            ? "border-red-200 bg-red-50 text-red-800"
            : "border-green-200 bg-green-50 text-green-800"
        )}>
          <span className="font-medium">
            {status === "rejected" ? "Rejection note" : "Approval note"}:
          </span>{" "}
          {timesheet.reviewNote}
          {timesheet.reviewerName && (
            <span className="text-xs opacity-70"> — {timesheet.reviewerName}</span>
          )}
        </div>
      )}

      {/* Submit button */}
      {canSubmit && onSubmit && (
        <div className="border-t border-gray-100 px-5 py-3">
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className={cn(
              "rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white transition-colors",
              "hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {submitting ? "Submitting…" : "Submit for Approval"}
          </button>
        </div>
      )}
    </div>
  );
}
