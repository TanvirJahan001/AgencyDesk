/**
 * components/attendance/SegmentTimeline.tsx — Visual Segment History
 *
 * Shows a chronological timeline of all work and break segments
 * for the current session, including the currently-open segment.
 * Uses V2 schema: startAt, endAt, durationMinutes (not ms-based fields).
 */

"use client";

import { minutesToReadable } from "@/lib/attendance/utils";
import { cn } from "@/lib/utils";
import type { AttendanceSegmentV2 } from "@/types";
import { Briefcase, Coffee } from "lucide-react";

interface SegmentTimelineProps {
  segments: AttendanceSegmentV2[];
}

function formatTimeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour:   "2-digit",
    minute: "2-digit",
  });
}

export default function SegmentTimeline({ segments }: SegmentTimelineProps) {
  if (segments.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-slate-400">
        No segments yet. Start work to begin tracking.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {segments.map((seg, idx) => {
        const isWork = seg.type === "work";
        const isOpen = !seg.endAt; // V2 uses endAt (null when open)

        return (
          <div
            key={seg.id ?? idx}
            className={cn(
              "flex items-center gap-3 rounded-lg p-3 text-sm",
              isWork ? "bg-blue-50 ring-1 ring-blue-100" : "bg-orange-50 ring-1 ring-orange-100",
              isOpen && "ring-2"
            )}
          >
            {/* Icon */}
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                isWork ? "bg-blue-100" : "bg-orange-100"
              )}
            >
              {isWork ? (
                <Briefcase className="h-4 w-4 text-blue-600" />
              ) : (
                <Coffee className="h-4 w-4 text-orange-600" />
              )}
            </div>

            {/* Details */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={cn("font-medium", isWork ? "text-blue-700" : "text-orange-700")}>
                  {isWork ? "Work" : "Break"} #{Math.floor(idx / 2) + 1}
                </span>
                {isOpen && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                      isWork ? "bg-blue-200 text-blue-800" : "bg-orange-200 text-orange-800"
                    )}
                  >
                    Live
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {formatTimeOnly(seg.startAt)}
                {seg.endAt ? ` — ${formatTimeOnly(seg.endAt)}` : " — now"}
              </p>
            </div>

            {/* Duration */}
            <span
              className={cn(
                "text-xs font-semibold tabular-nums",
                isWork ? "text-blue-600" : "text-orange-600"
              )}
            >
              {seg.durationMinutes > 0 ? minutesToReadable(seg.durationMinutes) : "…"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
