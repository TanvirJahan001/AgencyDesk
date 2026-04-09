/**
 * components/attendance/AttendancePanel.tsx — Main Attendance Widget
 *
 * Self-contained client component:
 *  - Fetches current session on mount AND on window focus (handles refresh)
 *  - Dispatches start/pause/resume/end to individual API routes
 *  - Shows a big live timer with HH:MM:SS, status label, today stats
 *  - Action buttons always reflect the real server state
 *  - Success + error banners auto-dismiss after a few seconds
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Play,
  Coffee,
  RotateCcw,
  StopCircle,
} from "lucide-react";
import { minutesToReadable, minutesToHMS } from "@/lib/attendance/utils";
import type { AttendanceSessionV2 } from "@/types";

// ── Types ──────────────────────────────────────────────────────

type OpenSegment = { type: string; startAt: string } | null;
type Status = AttendanceSessionV2["status"] | "idle";

// ── Status config ──────────────────────────────────────────────

const STATUS_CONFIG: Record<
  Status,
  { label: string; dot: string; text: string; bg: string }
> = {
  idle: {
    label: "Not Clocked In",
    dot:   "bg-slate-400",
    text:  "text-slate-700",
    bg:    "bg-slate-100",
  },
  working: {
    label: "Working",
    dot:   "bg-green-500 animate-pulse",
    text:  "text-green-800",
    bg:    "bg-green-100",
  },
  on_break: {
    label: "On Break",
    dot:   "bg-yellow-500 animate-pulse",
    text:  "text-yellow-800",
    bg:    "bg-yellow-100",
  },
  completed: {
    label: "Day Completed",
    dot:   "bg-blue-500",
    text:  "text-blue-800",
    bg:    "bg-blue-100",
  },
  missed_checkout: {
    label: "Missed Checkout",
    dot:   "bg-red-500",
    text:  "text-red-800",
    bg:    "bg-red-100",
  },
};

// ── Live timer hook ────────────────────────────────────────────

function useLiveSeconds(openSegment: OpenSegment): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!openSegment?.startAt) { setElapsed(0); return; }

    const tick = () => {
      const ms = Math.max(0, Date.now() - new Date(openSegment.startAt).getTime());
      setElapsed(Math.floor(ms / 1000));
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [openSegment?.startAt]);

  return elapsed;
}

// ── Stat pill ──────────────────────────────────────────────────

function StatPill({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: string;
  colorClass: string;
}) {
  return (
    <div className={`flex-1 rounded-xl p-4 text-center ${colorClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

// ── Action button ──────────────────────────────────────────────

function ActionBtn({
  label,
  icon: Icon,
  onClick,
  disabled,
  variant,
}: {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  disabled: boolean;
  variant: "green" | "orange" | "blue" | "red";
}) {
  const variantClasses = {
    green:  "bg-green-600 hover:bg-green-700 text-white shadow-green-200",
    orange: "bg-orange-500 hover:bg-orange-600 text-white shadow-orange-200",
    blue:   "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200",
    red:    "border-2 border-red-300 bg-red-50 hover:bg-red-100 text-red-700",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex flex-1 items-center justify-center gap-2.5 rounded-xl
        px-5 py-4 text-base font-semibold shadow-sm
        transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
      `}
    >
      {disabled
        ? <Loader2 className="h-5 w-5 animate-spin" />
        : <Icon className="h-5 w-5" />
      }
      {label}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────

export default function AttendancePanel() {
  const [session,     setSession]     = useState<AttendanceSessionV2 | null>(null);
  const [openSegment, setOpenSegment] = useState<OpenSegment>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [success,     setSuccess]     = useState<string | null>(null);
  const [busy,        setBusy]        = useState(false);

  const elapsedSec = useLiveSeconds(openSegment);

  // ── Fetch current session ───────────────────────────────────

  const fetchCurrent = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res  = await fetch("/api/attendance/current");
      const json = await res.json();

      if (!res.ok || !json.success) {
        if (!quiet) setError(json.error ?? `Server error ${res.status}`);
        return;
      }

      setSession(json.data.session ?? null);
      setOpenSegment(json.data.openSegment ?? null);
      setError(null);
    } catch (err) {
      if (!quiet) setError("Could not connect to server. Please refresh.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCurrent(); }, [fetchCurrent]);

  // Re-sync when window regains focus (handles browser refresh, tab switching)
  useEffect(() => {
    const onFocus = () => fetchCurrent(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchCurrent]);

  // Auto-dismiss banners
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 7000);
    return () => clearTimeout(t);
  }, [error]);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 5000);
    return () => clearTimeout(t);
  }, [success]);

  // ── Action dispatch ─────────────────────────────────────────

  const dispatch = useCallback(
    async (endpoint: string, successMsg: string) => {
      setBusy(true);
      setError(null);
      setSuccess(null);

      try {
        const res  = await fetch(endpoint, { method: "POST" });
        const json = await res.json();

        if (!json.success) {
          setError(json.error ?? "Something went wrong. Please try again.");
          return;
        }

        // Optimistic local update, then re-sync open segment
        setSession(json.data);
        await fetchCurrent(true);
        setSuccess(successMsg);
      } catch {
        setError("Network error. Please check your connection.");
      } finally {
        setBusy(false);
      }
    },
    [fetchCurrent]
  );

  const handleStart  = useCallback(() => dispatch("/api/attendance/start",  "You're clocked in. Have a great shift!"),  [dispatch]);
  const handlePause  = useCallback(() => dispatch("/api/attendance/pause",  "Break started. Enjoy your break!"),         [dispatch]);
  const handleResume = useCallback(() => dispatch("/api/attendance/resume", "Welcome back! You're working again."),       [dispatch]);
  const handleEnd    = useCallback(() => dispatch("/api/attendance/end",    "Work ended. Great job today!"),             [dispatch]);

  // ── Derived display values ──────────────────────────────────

  const status = (session?.status ?? "idle") as Status;
  const config = STATUS_CONFIG[status];

  const accWorkMin  = session?.totalWorkMinutes  ?? 0;
  const accBreakMin = session?.totalBreakMinutes ?? 0;
  const otMin       = session?.overtimeMinutes   ?? 0;

  const liveWorkMin  = accWorkMin  + (status === "working"  ? Math.floor(elapsedSec / 60) : 0);
  const liveBreakMin = accBreakMin + (status === "on_break" ? Math.floor(elapsedSec / 60) : 0);
  const extraSec     = status === "working" ? elapsedSec % 60 : 0;

  const timerDisplay = session
    ? minutesToHMS(liveWorkMin, extraSec)
    : "00:00:00";

  // ── Loading state ───────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        <p className="text-sm text-slate-400">Loading your session…</p>
      </div>
    );
  }

  // ── Completed / Missed checkout state ───────────────────────

  if (status === "completed" || status === "missed_checkout") {
    return (
      <div className="space-y-5">
        {/* Status badge */}
        <div className="flex justify-center">
          <span className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold ${config.bg} ${config.text}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${config.dot}`} />
            {config.label}
          </span>
        </div>

        {/* Finished summary card */}
        {status === "completed" && session && (
          <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-blue-500 mb-3" />
            <p className="text-lg font-bold text-slate-800">Day Complete!</p>
            <p className="text-3xl font-mono font-bold text-slate-900 mt-2 tabular-nums">
              {minutesToHMS(session.totalWorkMinutes)}
            </p>
            <p className="text-xs text-slate-500 mt-1">total work time today</p>

            <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg bg-white/70 p-3">
                <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Work</p>
                <p className="mt-1 font-bold text-blue-900">
                  {minutesToReadable(session.totalWorkMinutes)}
                </p>
              </div>
              <div className="rounded-lg bg-white/70 p-3">
                <p className="text-xs font-medium text-orange-600 uppercase tracking-wide">Break</p>
                <p className="mt-1 font-bold text-orange-900">
                  {minutesToReadable(session.totalBreakMinutes)}
                </p>
              </div>
              <div className="rounded-lg bg-white/70 p-3">
                <p className="text-xs font-medium text-purple-600 uppercase tracking-wide">Overtime</p>
                <p className="mt-1 font-bold text-purple-900">
                  {minutesToReadable(session.overtimeMinutes)}
                </p>
              </div>
            </div>
          </div>
        )}

        {status === "missed_checkout" && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-6 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-red-500 mb-3" />
            <p className="font-semibold text-red-800">Missed Checkout Detected</p>
            <p className="mt-1 text-sm text-red-600">
              Please contact your admin to correct yesterday's session.
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── Main clocked-in / idle state ─────────────────────────────

  return (
    <div className="space-y-5">
      {/* Success banner */}
      {success && (
        <div className="flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-600" />
          <p className="text-sm font-medium text-green-800">{success}</p>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Status badge — big & centred */}
      <div className="flex justify-center">
        <span
          className={`inline-flex items-center gap-2.5 rounded-full px-5 py-2 text-sm font-semibold ${config.bg} ${config.text}`}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${config.dot}`} />
          {config.label}
        </span>
      </div>

      {/* Big timer clock */}
      <div
        className={`rounded-2xl px-6 py-10 text-center transition-colors ${
          status === "working"  ? "bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100"
          : status === "on_break" ? "bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-100"
          : "bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 border-dashed"
        }`}
      >
        <p className="mb-2 text-xs font-medium tracking-widest text-slate-400 uppercase">
          {status === "idle"     ? "Clock in to start your day"
           : status === "working"  ? "Time at work today"
           : "Total work time today"}
        </p>

        <p
          className={`text-7xl font-mono font-bold tracking-tight tabular-nums leading-none ${
            status === "idle" ? "text-slate-300" : "text-slate-900"
          }`}
        >
          {timerDisplay}
        </p>

        {status === "on_break" && (
          <p className="mt-3 text-sm text-yellow-700 font-medium">
            ☕ Break in progress — timer paused
          </p>
        )}
      </div>

      {/* Today stats row — only show when active */}
      {session && (
        <div className="flex gap-3">
          <StatPill
            label="Today Work"
            value={minutesToReadable(liveWorkMin)}
            colorClass="bg-blue-50 text-blue-800"
          />
          <StatPill
            label="Today Break"
            value={minutesToReadable(liveBreakMin)}
            colorClass="bg-orange-50 text-orange-800"
          />
          {otMin > 0 && (
            <StatPill
              label="Overtime"
              value={minutesToReadable(otMin)}
              colorClass="bg-purple-50 text-purple-800"
            />
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 pt-1">
        {status === "idle" && (
          <ActionBtn
            label="Start Work"
            icon={Play}
            onClick={handleStart}
            disabled={busy}
            variant="green"
          />
        )}

        {status === "working" && (
          <>
            <ActionBtn
              label="Take a Break"
              icon={Coffee}
              onClick={handlePause}
              disabled={busy}
              variant="orange"
            />
            <ActionBtn
              label="End Work"
              icon={StopCircle}
              onClick={handleEnd}
              disabled={busy}
              variant="red"
            />
          </>
        )}

        {status === "on_break" && (
          <>
            <ActionBtn
              label="Resume Work"
              icon={RotateCcw}
              onClick={handleResume}
              disabled={busy}
              variant="blue"
            />
            <ActionBtn
              label="End Work"
              icon={StopCircle}
              onClick={handleEnd}
              disabled={busy}
              variant="red"
            />
          </>
        )}
      </div>
    </div>
  );
}
