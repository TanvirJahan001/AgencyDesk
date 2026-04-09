/**
 * components/attendance/AttendanceControls.tsx — Action Buttons
 *
 * Renders the appropriate buttons based on the current session status:
 *   idle      → [Start Work]
 *   active    → [Pause] [End Work]
 *   paused    → [Resume] [End Work]
 *   completed → (no actions — day is done)
 */

"use client";

import { cn } from "@/lib/utils";
import type { SessionStatus } from "@/types";
import { Play, Pause, RotateCcw, Square, Loader2 } from "lucide-react";

interface AttendanceControlsProps {
  status:    SessionStatus | "idle";
  loading:   boolean;
  onStart:   () => void;
  onPause:   () => void;
  onResume:  () => void;
  onEnd:     () => void;
}

export default function AttendanceControls({
  status,
  loading,
  onStart,
  onPause,
  onResume,
  onEnd,
}: AttendanceControlsProps) {
  // Completed — nothing to do
  if (status === "completed") {
    return (
      <p className="text-center text-sm text-slate-500">
        Your work session for today is complete. See you tomorrow!
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* IDLE → Start */}
      {status === "idle" && (
        <button
          onClick={onStart}
          disabled={loading}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-6 py-3",
            "bg-blue-600 text-white font-semibold text-sm shadow-md",
            "hover:bg-blue-700 active:bg-blue-800",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-colors duration-150"
          )}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Start Work
        </button>
      )}

      {/* ACTIVE → Pause + End */}
      {status === "active" && (
        <>
          <button
            onClick={onPause}
            disabled={loading}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-5 py-3",
              "bg-orange-500 text-white font-semibold text-sm shadow-md",
              "hover:bg-orange-600 active:bg-orange-700",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors duration-150"
            )}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Pause className="h-4 w-4" />
            )}
            Take Break
          </button>
          <button
            onClick={onEnd}
            disabled={loading}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-5 py-3",
              "bg-red-600 text-white font-semibold text-sm shadow-md",
              "hover:bg-red-700 active:bg-red-800",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors duration-150"
            )}
          >
            <Square className="h-4 w-4" />
            End Work
          </button>
        </>
      )}

      {/* PAUSED → Resume + End */}
      {status === "paused" && (
        <>
          <button
            onClick={onResume}
            disabled={loading}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-5 py-3",
              "bg-blue-600 text-white font-semibold text-sm shadow-md",
              "hover:bg-blue-700 active:bg-blue-800",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors duration-150"
            )}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Resume Work
          </button>
          <button
            onClick={onEnd}
            disabled={loading}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-5 py-3",
              "bg-red-600 text-white font-semibold text-sm shadow-md",
              "hover:bg-red-700 active:bg-red-800",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors duration-150"
            )}
          >
            <Square className="h-4 w-4" />
            End Work
          </button>
        </>
      )}
    </div>
  );
}
