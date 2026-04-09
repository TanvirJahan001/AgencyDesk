/**
 * components/attendance/LiveTimer.tsx — Live Attendance Timer
 *
 * Shows elapsed work time + break time, updates every second.
 * The HH:MM:SS timer displays total work time for the day.
 * While "working" the seconds tick up live; otherwise they freeze.
 */

"use client";

import { useEffect, useState } from "react";
import { minutesToReadable, minutesToHMS } from "@/lib/attendance/utils";
import StatusBadge from "./StatusBadge";
import type { AttendanceSessionV2 } from "@/types";

interface LiveTimerProps {
  session: AttendanceSessionV2 | null;
  openSegment: { type: string; startAt: string } | null;
}

export default function LiveTimer({ session, openSegment }: LiveTimerProps) {
  // elapsed = seconds since current open segment started
  const [elapsedSec, setElapsedSec] = useState(0);

  const status = session?.status ?? "idle";

  // Tick every second while there is an open segment
  useEffect(() => {
    if (!openSegment?.startAt) {
      setElapsedSec(0);
      return;
    }

    const tick = () => {
      const diffMs = Math.max(0, Date.now() - new Date(openSegment.startAt).getTime());
      setElapsedSec(Math.floor(diffMs / 1000));
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [openSegment]);

  // Accumulated minutes from server (fixed between API calls)
  const accWorkMin  = session?.totalWorkMinutes  ?? 0;
  const accBreakMin = session?.totalBreakMinutes ?? 0;

  // Live totals: add elapsed for the current segment type
  const liveWorkMin  = accWorkMin  + (status === "working"  ? Math.floor(elapsedSec / 60) : 0);
  const liveBreakMin = accBreakMin + (status === "on_break" ? Math.floor(elapsedSec / 60) : 0);

  // Extra sub-minute seconds — only tick during "working"
  const extraSec = status === "working" ? elapsedSec % 60 : 0;

  // HH:MM:SS based on total work time
  const timerDisplay = minutesToHMS(liveWorkMin, extraSec);

  // Today's date label
  const todayStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month:   "long",
    day:     "numeric",
    year:    "numeric",
  });

  if (!session) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center">
        <p className="text-sm text-slate-500">Clock in to start your day</p>
        <p className="mt-3 text-5xl font-mono font-bold text-slate-300">00:00:00</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status badge */}
      <StatusBadge status={status} />

      {/* Main timer clock */}
      <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 px-6 py-8 text-center">
        <p className="mb-3 text-xs font-medium tracking-wide text-slate-500 uppercase">
          {todayStr}
        </p>
        <p className="text-6xl font-mono font-bold tracking-tight text-slate-900 tabular-nums">
          {timerDisplay}
        </p>
        <p className="mt-3 text-xs text-slate-400">Total work time today</p>
      </div>

      {/* Work / Break / OT summary row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-blue-50 p-4 text-center">
          <p className="text-xs font-medium text-blue-600">Work</p>
          <p className="mt-1 text-lg font-bold text-blue-800">
            {minutesToReadable(liveWorkMin)}
          </p>
        </div>
        <div className="rounded-lg bg-orange-50 p-4 text-center">
          <p className="text-xs font-medium text-orange-600">Break</p>
          <p className="mt-1 text-lg font-bold text-orange-800">
            {minutesToReadable(liveBreakMin)}
          </p>
        </div>
        <div className="rounded-lg bg-red-50 p-4 text-center">
          <p className="text-xs font-medium text-red-600">Overtime</p>
          <p className="mt-1 text-lg font-bold text-red-800">
            {minutesToReadable(session.overtimeMinutes)}
          </p>
        </div>
      </div>
    </div>
  );
}
