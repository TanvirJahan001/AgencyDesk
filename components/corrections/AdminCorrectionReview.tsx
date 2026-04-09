/**
 * components/corrections/AdminCorrectionReview.tsx
 *
 * Admin panel showing all pending correction requests.
 * Each request has Approve/Reject buttons and an optional note field.
 * Fetches from /api/attendance/corrections?status=pending
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { CorrectionRequest } from "@/types";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Inbox,
} from "lucide-react";

export default function AdminCorrectionReview() {
  const [corrections, setCorrections] = useState<CorrectionRequest[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [notes,       setNotes]       = useState<Record<string, string>>({});

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch("/api/attendance/corrections?status=pending");
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) setCorrections(json.data?.corrections ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  async function handleReview(correctionId: string, action: "approve" | "reject") {
    setActioningId(correctionId);
    setError(null);

    try {
      const res = await fetch(`/api/attendance/corrections/${correctionId}/review`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          action,
          note: notes[correctionId]?.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Action failed.");
        return;
      }

      // Remove from list
      setCorrections((prev) => prev.filter((c) => c.id !== correctionId));
    } catch {
      setError("Network error.");
    } finally {
      setActioningId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">Loading requests...</span>
      </div>
    );
  }

  if (corrections.length === 0) {
    return (
      <div className="text-center py-12">
        <Inbox className="mx-auto h-10 w-10 text-slate-300 mb-3" />
        <p className="text-sm text-slate-500">No pending correction requests.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Global error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <p className="text-sm text-slate-500">
        {corrections.length} pending request{corrections.length !== 1 ? "s" : ""}
      </p>

      {corrections.map((corr) => {
        const isExpanded = expandedId === corr.id;
        const isActioning = actioningId === corr.id;

        return (
          <div
            key={corr.id}
            className="rounded-xl bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden"
          >
            {/* Summary row */}
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : corr.id)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-100">
                <MessageSquare className="h-4 w-4 text-yellow-700" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {corr.employeeName}
                </p>
                <p className="text-xs text-slate-500">
                  Session: {corr.sessionDate} &middot; {corr.changes.length} change{corr.changes.length !== 1 ? "s" : ""}
                </p>
              </div>
              <span className="text-xs text-slate-400">
                {new Date(corr.createdAt).toLocaleDateString("en-US", {
                  month: "short", day: "numeric",
                })}
              </span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
                {/* Changes table */}
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-600 mb-2">Requested Changes</p>
                  {corr.changes.map((c, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm py-1">
                      <span className="w-24 text-xs font-medium text-slate-500">{c.field}</span>
                      <span className="text-red-600 line-through text-xs">{c.oldValue || "—"}</span>
                      <span className="text-slate-300">→</span>
                      <span className="text-green-700 font-semibold text-xs">{c.newValue}</span>
                    </div>
                  ))}
                </div>

                {/* Reason */}
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-1">Employee Reason</p>
                  <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 italic">
                    &ldquo;{corr.reason}&rdquo;
                  </p>
                </div>

                {/* Admin note */}
                <div>
                  <label
                    htmlFor={`note-${corr.id}`}
                    className="text-xs font-semibold text-slate-600 mb-1 block"
                  >
                    Your Note (optional)
                  </label>
                  <textarea
                    id={`note-${corr.id}`}
                    value={notes[corr.id] ?? ""}
                    onChange={(e) =>
                      setNotes((n) => ({ ...n, [corr.id]: e.target.value }))
                    }
                    placeholder="Add a note for the employee..."
                    rows={2}
                    className="input resize-none text-sm"
                    disabled={isActioning}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReview(corr.id, "approve")}
                    disabled={isActioning}
                    className={cn(
                      "inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5",
                      "bg-green-600 text-white text-sm font-semibold",
                      "hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed",
                      "transition-colors"
                    )}
                  >
                    {isActioning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Approve
                  </button>
                  <button
                    onClick={() => handleReview(corr.id, "reject")}
                    disabled={isActioning}
                    className={cn(
                      "inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5",
                      "bg-red-600 text-white text-sm font-semibold",
                      "hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed",
                      "transition-colors"
                    )}
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
