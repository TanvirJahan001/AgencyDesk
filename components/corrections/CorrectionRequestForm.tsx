/**
 * components/corrections/CorrectionRequestForm.tsx
 *
 * Employee form to submit a correction request for a specific attendance session.
 * Updated to use V2 schema: clockInAt/clockOutAt/workDate instead of startTime/endTime/date.
 * Session prop typed as `any` since it comes from EmployeeAttendanceClient as AttendanceSessionV2.
 */

"use client";

import { useState, FormEvent } from "react";
import { cn } from "@/lib/utils";
import type { CorrectionChange, CorrectionField } from "@/types";
import { Send, Loader2, AlertCircle, CheckCircle2, X } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface CorrectionRequestFormProps {
  // Accept any session shape (V2 schema: clockInAt/clockOutAt/workDate/status/id)
  session: any;
  onSuccess?: () => void;
  onClose?: () => void;
}

const EDITABLE_FIELDS: { field: CorrectionField; label: string; type: string }[] = [
  { field: "clockIn",  label: "Clock In Time",  type: "datetime-local" },
  { field: "clockOut", label: "Clock Out Time", type: "datetime-local" },
  { field: "status",   label: "Status",         type: "select"         },
  { field: "date",     label: "Date",           type: "date"           },
];

/**
 * Extract the current field value from a V2 session document.
 * V2 uses clockInAt, clockOutAt, workDate (not startTime, endTime, date).
 */
function sessionFieldValue(session: any, field: CorrectionField): string {
  switch (field) {
    case "clockIn":  return (session.clockInAt  ?? session.startTime  ?? "").slice(0, 16);
    case "clockOut": return (session.clockOutAt ?? session.endTime    ?? "").slice(0, 16);
    case "status":   return session.status ?? "";
    case "date":     return session.workDate ?? session.date ?? "";
  }
}

export default function CorrectionRequestForm({
  session,
  onSuccess,
  onClose,
}: CorrectionRequestFormProps) {
  const [reason,         setReason]         = useState("");
  const [selectedFields, setSelected]       = useState<Set<CorrectionField>>(new Set());
  const [values,         setValues]         = useState<Record<string, string>>({});
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [success,        setSuccess]        = useState(false);
  const [showConfirm,    setShowConfirm]    = useState(false);
  const [pendingChanges, setPendingChanges] = useState<CorrectionChange[]>([]);

  function toggleField(field: CorrectionField) {
    const next = new Set(selectedFields);
    if (next.has(field)) {
      next.delete(field);
    } else {
      next.add(field);
      if (!values[field]) {
        setValues((v) => ({ ...v, [field]: sessionFieldValue(session, field) }));
      }
    }
    setSelected(next);
  }

  function updateValue(field: string, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (selectedFields.size === 0) {
      setError("Select at least one field to correct.");
      return;
    }
    if (reason.trim().length < 10) {
      setError("Please provide a detailed reason (at least 10 characters).");
      return;
    }

    const changes: CorrectionChange[] = [];
    for (const field of Array.from(selectedFields)) {
      const oldVal = sessionFieldValue(session, field);
      const newVal = values[field] ?? "";
      if (newVal === oldVal) {
        setError(`New value for "${field}" is the same as the current value.`);
        return;
      }
      changes.push({ field, oldValue: oldVal, newValue: newVal });
    }

    setPendingChanges(changes);
    setShowConfirm(true);
  }

  async function handleConfirmedSubmit() {
    setLoading(true);
    setShowConfirm(false);

    try {
      const res = await fetch("/api/attendance/corrections", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          sessionId: session.id,
          reason:    reason.trim(),
          changes:   pendingChanges,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Failed to submit correction.");
        return;
      }

      setSuccess(true);
      onSuccess?.();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Success state ──

  if (success) {
    return (
      <div className="py-6 text-center">
        <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-500" />
        <p className="font-semibold text-slate-900">Request Submitted</p>
        <p className="mt-1 text-sm text-slate-500">
          Your correction request is pending admin review.
        </p>
        {onClose && (
          <button onClick={onClose} className="btn-ghost mt-4 text-sm">
            Close
          </button>
        )}
      </div>
    );
  }

  // Friendly date label for the form header (V2: workDate field)
  const sessionDate = session.workDate ?? session.date ?? "unknown date";
  const clockInTime = session.clockInAt ?? session.startTime;
  const clockInLabel = clockInTime
    ? new Date(clockInTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : "unknown time";

  // ── Form ──

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Request Correction</h3>
          <p className="text-xs text-slate-500">
            Session: {sessionDate} &middot; {clockInLabel}
          </p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Field selection */}
      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">What needs to be corrected?</p>
        <div className="space-y-3">
          {EDITABLE_FIELDS.map(({ field, label, type }) => {
            const isSelected = selectedFields.has(field);
            const currentVal = sessionFieldValue(session, field);

            return (
              <div
                key={field}
                className={cn(
                  "cursor-pointer rounded-lg p-3 ring-1 transition-colors",
                  isSelected
                    ? "bg-blue-50 ring-blue-300"
                    : "bg-slate-50 ring-slate-200 hover:ring-slate-300"
                )}
                onClick={() => toggleField(field)}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleField(field)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  <span className="text-sm font-medium text-slate-700">{label}</span>
                  <span className="ml-auto text-xs text-slate-400">
                    Current: {currentVal || "—"}
                  </span>
                </div>

                {isSelected && (
                  <div className="mt-2 pl-6" onClick={(e) => e.stopPropagation()}>
                    {type === "select" ? (
                      <select
                        value={values[field] ?? currentVal}
                        onChange={(e) => updateValue(field, e.target.value)}
                        className="input text-sm"
                      >
                        {/* V2 status values */}
                        <option value="working">Working</option>
                        <option value="on_break">On Break</option>
                        <option value="completed">Completed</option>
                        <option value="missed_checkout">Missed Checkout</option>
                      </select>
                    ) : (
                      <input
                        type={type}
                        value={values[field] ?? currentVal}
                        onChange={(e) => updateValue(field, e.target.value)}
                        className="input text-sm"
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Reason */}
      <div>
        <label htmlFor="correction-reason" className="mb-1.5 block text-sm font-medium text-slate-700">
          Reason for correction
        </label>
        <textarea
          id="correction-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain why this correction is needed (e.g., forgot to clock in, system error, wrong time)..."
          rows={3}
          className="input resize-none"
          disabled={loading}
        />
        <p className="mt-1 text-xs text-slate-400">{reason.trim().length}/10 characters minimum</p>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || selectedFields.size === 0}
        className="btn-primary w-full justify-center"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Submitting…
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            Submit Correction Request
          </>
        )}
      </button>

      {/* Confirmation dialog */}
      <ConfirmDialog
        open={showConfirm}
        title="Submit Correction Request?"
        message={`You are about to request ${pendingChanges.length} correction${pendingChanges.length !== 1 ? "s" : ""} for your session on ${sessionDate}.`}
        detail="Once submitted, an admin will review your request. You cannot edit it after submission."
        confirmLabel="Yes, Submit"
        cancelLabel="Go Back"
        confirmVariant="primary"
        onConfirm={handleConfirmedSubmit}
        onCancel={() => setShowConfirm(false)}
      />
    </form>
  );
}
