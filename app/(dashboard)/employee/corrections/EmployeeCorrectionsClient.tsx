/**
 * app/(dashboard)/employee/corrections/EmployeeCorrectionsClient.tsx
 *
 * Client component for the employee corrections page.
 * Shows correction request history and lets user open a form
 * to request a new correction tied to a past session.
 *
 * Uses V2 APIs: /api/attendance/history for sessions,
 * /api/attendance/corrections for correction requests.
 */

"use client";

import { useState, useEffect } from "react";
import type { AttendanceSessionV2, CorrectionRequest } from "@/types";
import CorrectionRequestForm from "@/components/corrections/CorrectionRequestForm";
import { cn } from "@/lib/utils";
import { Loader2, FileEdit, CheckCircle2, XCircle, Clock } from "lucide-react";

const STATUS_INFO: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  pending:  { label: "Pending",  icon: Clock,        cls: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Approved", icon: CheckCircle2, cls: "bg-green-100 text-green-800"  },
  rejected: { label: "Rejected", icon: XCircle,      cls: "bg-red-100 text-red-800"      },
};

/** Format minutes to readable string */
function minToReadable(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function EmployeeCorrectionsClient() {
  const [sessions,     setSessions]     = useState<AttendanceSessionV2[]>([]);
  const [corrections,  setCorrections]  = useState<CorrectionRequest[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showModal,    setShowModal]    = useState(false);
  const [selectedSess, setSelectedSess] = useState<AttendanceSessionV2 | null>(null);

  async function fetchData() {
    setLoading(true);
    try {
      const [sessRes, corrRes] = await Promise.all([
        fetch("/api/attendance/history?from=" + daysAgo(60)),
        fetch("/api/attendance/corrections?status=all"),
      ]);

      if (sessRes.ok) {
        const sessJson = await sessRes.json();
        if (sessJson.success && Array.isArray(sessJson.data)) {
          setSessions(sessJson.data);
        }
      }

      if (corrRes.ok) {
        const corrJson = await corrRes.json();
        if (corrJson.success) {
          setCorrections(corrJson.data?.corrections ?? []);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  function openModal(session: AttendanceSessionV2) {
    setSelectedSess(session);
    setShowModal(true);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Correction Requests</h1>
          <p className="mt-1 text-sm text-slate-500">
            Request a fix for any attendance mistake. Admin will review and approve.
          </p>
        </div>
      </div>

      {/* Request history */}
      <div className="card">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">My Requests</h2>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : corrections.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
            No correction requests yet.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {corrections.map((cr) => {
              const info = STATUS_INFO[cr.status] ?? STATUS_INFO.pending;
              const Icon = info.icon;
              return (
                <div key={cr.id} className="flex items-start gap-4 py-3">
                  <div className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    info.cls.replace("text-", "bg-").replace("-800", "-100").replace("-700", "-100")
                  )}>
                    <Icon className={cn("h-3.5 w-3.5", info.cls.split(" ")[1])} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-slate-900">{cr.sessionDate}</p>
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", info.cls)}>
                        {info.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{cr.reason}</p>
                    {cr.reviewNote && (
                      <p className="mt-1 rounded bg-slate-50 px-2 py-1 text-xs text-slate-600 italic">
                        Admin: {cr.reviewNote}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 text-xs text-slate-400">
                    {new Date(cr.createdAt).toLocaleDateString()}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Session list to pick from */}
      <div className="card">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">
          Request a New Correction
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          Select the session you need to correct, then fill in the form.
        </p>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
            No attendance sessions found.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {sessions.map((sess) => (
              <div
                key={sess.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{sess.workDate}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(sess.clockInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {sess.clockOutAt && ` → ${new Date(sess.clockOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                    {" · "}{minToReadable(sess.totalWorkMinutes)} worked
                  </p>
                </div>
                <button
                  onClick={() => openModal(sess)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                >
                  <FileEdit className="h-3.5 w-3.5" />
                  Request Fix
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Correction modal */}
      {showModal && selectedSess && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-lg -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl">
            <CorrectionRequestForm
              session={selectedSess}
              onSuccess={() => {
                setShowModal(false);
                fetchData();
              }}
              onClose={() => setShowModal(false)}
            />
          </div>
        </>
      )}
    </div>
  );
}

/** YYYY-MM-DD date N days before today */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
