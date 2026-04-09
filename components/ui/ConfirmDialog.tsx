/**
 * components/ui/ConfirmDialog.tsx
 *
 * Reusable confirmation modal.
 * Use before irreversible or significant actions:
 *   End Work, Submit Request, Approve Timesheet, Lock Payroll, etc.
 *
 * Usage:
 *   <ConfirmDialog
 *     open={showConfirm}
 *     title="End Work?"
 *     message="You are about to end your work session for today. This cannot be undone."
 *     confirmLabel="Yes, End Work"
 *     confirmVariant="danger"   // "danger" | "primary"
 *     onConfirm={handleEnd}
 *     onCancel={() => setShowConfirm(false)}
 *   />
 */

"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConfirmVariant = "danger" | "primary" | "warning";

interface ConfirmDialogProps {
  open:            boolean;
  title:           string;
  message:         string;
  detail?:         string;       // secondary helper text
  confirmLabel?:   string;       // default: "Confirm"
  cancelLabel?:    string;       // default: "Cancel"
  confirmVariant?: ConfirmVariant; // default: "primary"
  loading?:        boolean;
  onConfirm:       () => void;
  onCancel:        () => void;
}

const VARIANT_STYLES: Record<ConfirmVariant, { btn: string; icon: string; iconBg: string }> = {
  danger: {
    btn:    "bg-red-600 hover:bg-red-700 text-white",
    icon:   "text-red-600",
    iconBg: "bg-red-100",
  },
  warning: {
    btn:    "bg-orange-500 hover:bg-orange-600 text-white",
    icon:   "text-orange-500",
    iconBg: "bg-orange-100",
  },
  primary: {
    btn:    "bg-brand-600 hover:bg-brand-700 text-white",
    icon:   "text-brand-600",
    iconBg: "bg-brand-50",
  },
};

export default function ConfirmDialog({
  open,
  title,
  message,
  detail,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "primary",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const styles    = VARIANT_STYLES[confirmVariant];

  // Focus cancel button on open (safer default)
  useEffect(() => {
    if (open) {
      setTimeout(() => cancelRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const Icon = confirmVariant === "primary" ? CheckCircle2 : AlertTriangle;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-sm -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl"
      >
        {/* Close X */}
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon + Title */}
        <div className="mb-4 flex items-start gap-4">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", styles.iconBg)}>
            <Icon className={cn("h-5 w-5", styles.icon)} />
          </div>
          <div>
            <h2
              id="confirm-title"
              className="text-base font-semibold text-slate-900"
            >
              {title}
            </h2>
            <p
              id="confirm-message"
              className="mt-1 text-sm text-slate-500 leading-relaxed"
            >
              {message}
            </p>
            {detail && (
              <p className="mt-1.5 text-xs text-slate-400">{detail}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-50",
              styles.btn
            )}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
