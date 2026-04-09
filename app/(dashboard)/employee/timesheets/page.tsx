/**
 * app/(dashboard)/employee/timesheets/page.tsx
 *
 * Employee's weekly/monthly timesheet management page.
 * Auto-generates the current week's timesheet on first visit
 * so employees always see something right away.
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { useTimesheets } from "@/hooks/useTimesheets";
import TimesheetGenerator from "@/components/timesheets/TimesheetGenerator";
import TimesheetList from "@/components/timesheets/TimesheetList";
import { Clock, Loader2, Info } from "lucide-react";

export default function EmployeeTimesheetsPage() {
  const { timesheets, loading, error, generateFromDate, submit } = useTimesheets();
  const [generating,     setGenerating]     = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [genError,       setGenError]       = useState<string | null>(null);
  const [genInfo,        setGenInfo]        = useState<string | null>(null);

  // Only auto-generate once per mount
  const didAutoGen = useRef(false);

  // After initial load, if no timesheets exist, silently generate this week
  useEffect(() => {
    if (loading || didAutoGen.current || timesheets.length > 0) return;
    didAutoGen.current = true;

    (async () => {
      setAutoGenerating(true);
      const today = new Date().toISOString().slice(0, 10);
      const result = await generateFromDate("weekly", today);
      setAutoGenerating(false);
      if (result) {
        setGenInfo("Your current week's timesheet has been generated automatically.");
      }
      // If it fails (e.g., no sessions yet), we silently ignore — the empty
      // state message will guide the employee.
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, timesheets.length]);

  async function handleGenerate(periodType: "weekly" | "monthly", date: string) {
    setGenerating(true);
    setGenError(null);
    setGenInfo(null);
    const result = await generateFromDate(periodType, date);
    if (!result) {
      setGenError(
        "Could not generate timesheet. The period may already exist, have no sessions, or be locked."
      );
    } else {
      setGenInfo("Timesheet generated successfully.");
    }
    setGenerating(false);
  }

  const isLoading = loading || autoGenerating;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100">
          <Clock className="h-5 w-5 text-brand-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">My Timesheets</h1>
          <p className="text-sm text-gray-500">
            Generate and submit weekly or monthly timesheets from your attendance records.
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Timesheets summarise your clock-in / clock-out records for a period. Generate one
          below, then submit it to your admin for approval.
        </p>
      </div>

      {/* Generator */}
      <TimesheetGenerator onGenerate={handleGenerate} generating={generating} />

      {/* Feedback */}
      {genError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {genError}
        </div>
      )}
      {(error || genInfo) && !genError && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-700"
          }`}
        >
          {error || genInfo}
        </div>
      )}

      {/* Timesheets list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
          <span className="text-sm text-gray-500">
            {autoGenerating ? "Generating your timesheet…" : "Loading timesheets…"}
          </span>
        </div>
      ) : (
        <TimesheetList timesheets={timesheets} onSubmit={submit} />
      )}
    </div>
  );
}
