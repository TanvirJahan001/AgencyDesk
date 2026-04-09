/**
 * components/attendance/TodaySummary.tsx — Today's Summary Stats
 *
 * Shows work time, break time, and overtime at a glance.
 */

import { minutesToReadable } from "@/lib/attendance/utils";

interface TodaySummaryProps {
  totalWorkMinutes: number;
  totalBreakMinutes: number;
  overtimeMinutes: number;
}

export default function TodaySummary({
  totalWorkMinutes,
  totalBreakMinutes,
  overtimeMinutes,
}: TodaySummaryProps) {
  return (
    <div className="grid grid-cols-3 gap-4 rounded-lg bg-slate-50 p-4">
      <div>
        <p className="text-xs font-medium text-slate-600">Work Time</p>
        <p className="mt-1 text-lg font-semibold text-blue-700">
          {minutesToReadable(totalWorkMinutes)}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-600">Break Time</p>
        <p className="mt-1 text-lg font-semibold text-orange-700">
          {minutesToReadable(totalBreakMinutes)}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-600">Overtime</p>
        <p className="mt-1 text-lg font-semibold text-red-700">
          {minutesToReadable(overtimeMinutes)}
        </p>
      </div>
    </div>
  );
}
