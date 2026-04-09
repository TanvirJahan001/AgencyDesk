/**
 * components/corrections/MyCorrectionsList.tsx
 *
 * Employee view — shows all their correction requests with status badges.
 * Pending requests show prominently at the top.
 */

"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { CorrectionRequest } from "@/types";
import { Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";

const STATUS_CONFIG: Record<string, { icon: typeof Clock; color: string; bg: string; label: string }> = {
  pending:  { icon: Clock,        color: "text-yellow-700", bg: "bg-yellow-50 ring-yellow-200", label: "Pending Review" },
  approved: { icon: CheckCircle2, color: "text-green-700",  bg: "bg-green-50 ring-green-200",   label: "Approved"       },
  rejected: { icon: XCircle,      color: "text-red-700",    bg: "bg-red-50 ring-red-200",       label: "Rejected"       },
};

export default function MyCorrectionsList() {
  const [corrections, setCorrections] = useState<CorrectionRequest[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    fetch("/api/attendance/corrections")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setCorrections(json.data.corrections);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (corrections.length === 0) {
    return (
      <p className="text-center text-sm text-slate-400 py-6">
        No correction requests yet.
      </p>
    );
  }

  // Sort: pending first, then by date desc
  const sorted = [...corrections].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="space-y-3">
      {sorted.map((corr) => {
        const config = STATUS_CONFIG[corr.status];
        const Icon   = config.icon;

        return (
          <div
            key={corr.id}
            className={cn("rounded-lg p-4 ring-1", config.bg)}
          >
            {/* Header row */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Icon className={cn("h-4 w-4 shrink-0", config.color)} />
                <span className={cn("text-sm font-semibold", config.color)}>
                  {config.label}
                </span>
              </div>
              <span className="text-xs text-slate-400">
                {new Date(corr.createdAt).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                })}
              </span>
            </div>

            {/* Session date */}
            <p className="mt-1 text-sm text-slate-700">
              Session: <span className="font-medium">{corr.sessionDate}</span>
            </p>

            {/* Changes */}
            <div className="mt-2 space-y-1">
              {corr.changes.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-slate-600 w-20">{c.field}:</span>
                  <span className="text-red-600 line-through">{c.oldValue || "—"}</span>
                  <span className="text-slate-400">→</span>
                  <span className="text-green-700 font-medium">{c.newValue}</span>
                </div>
              ))}
            </div>

            {/* Reason */}
            <p className="mt-2 text-xs text-slate-500 italic">
              &ldquo;{corr.reason}&rdquo;
            </p>

            {/* Admin review note */}
            {corr.reviewNote && (
              <div className="mt-2 rounded bg-white/60 p-2 text-xs text-slate-600">
                <span className="font-semibold">Admin note:</span> {corr.reviewNote}
                {corr.reviewerName && (
                  <span className="text-slate-400"> — {corr.reviewerName}</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
