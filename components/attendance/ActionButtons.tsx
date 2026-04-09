/**
 * components/attendance/ActionButtons.tsx — Attendance Action Buttons
 *
 * Shows ONLY the buttons that are valid for the current session status.
 * Status machine:
 *   idle       → [Start Work]
 *   working    → [Pause for Break] [End Work]
 *   on_break   → [Resume Work]
 *   completed  → (no buttons, day is done)
 *   missed_checkout → (no buttons)
 */

"use client";

import { Loader2 } from "lucide-react";
import type { SessionStatusV2 } from "@/types";

interface ActionButtonsProps {
  status:   SessionStatusV2 | "idle";
  disabled?: boolean;
  onStart:  () => Promise<void>;
  onPause:  () => Promise<void>;
  onResume: () => Promise<void>;
  onEnd:    () => Promise<void>;
}

export default function ActionButtons({
  status,
  disabled = false,
  onStart,
  onPause,
  onResume,
  onEnd,
}: ActionButtonsProps) {

  if (status === "completed" || status === "missed_checkout") {
    return (
      <div className="rounded-xl bg-slate-50 p-6 text-center">
        <p className="text-sm font-medium text-slate-600">
          {status === "completed"
            ? "✓ Day completed. See you tomorrow!"
            : "⚠ Missed checkout — please contact your admin."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {/* ── idle: only Start Work ── */}
      {status === "idle" && (
        <button
          onClick={onStart}
          disabled={disabled}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:opacity-50"
        >
          {disabled && <Loader2 className="h-4 w-4 animate-spin" />}
          Start Work
        </button>
      )}

      {/* ── working: Pause + End ── */}
      {status === "working" && (
        <>
          <button
            onClick={onPause}
            disabled={disabled}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-orange-300 bg-orange-50 px-6 py-4 text-base font-semibold text-orange-700 transition hover:bg-orange-100 disabled:opacity-50"
          >
            {disabled && <Loader2 className="h-4 w-4 animate-spin" />}
            Pause for Break
          </button>
          <button
            onClick={onEnd}
            disabled={disabled}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-red-300 bg-red-50 px-6 py-4 text-base font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
          >
            {disabled && <Loader2 className="h-4 w-4 animate-spin" />}
            End Work
          </button>
        </>
      )}

      {/* ── on_break: Resume ── */}
      {status === "on_break" && (
        <button
          onClick={onResume}
          disabled={disabled}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
        >
          {disabled && <Loader2 className="h-4 w-4 animate-spin" />}
          Resume Work
        </button>
      )}
    </div>
  );
}
