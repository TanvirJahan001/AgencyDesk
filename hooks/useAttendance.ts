/**
 * hooks/useAttendance.ts — Client-side attendance state manager
 *
 * Handles:
 *  - Fetching current session state from /api/attendance on mount
 *  - Dispatching start/pause/resume/end actions
 *  - Running a 1-second interval to update the live timer
 *  - Surviving page refreshes (re-fetches from server)
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { computeLiveTotals, elapsedSince } from "@/lib/attendance/utils";
import type {
  AttendanceSession,
  AttendanceSegment,
  LiveTimerState,
  SessionStatus,
  SegmentType,
} from "@/types";

interface UseAttendanceReturn {
  /** Live timer state — updates every second */
  timer:    LiveTimerState;
  /** Full session object from server (null if no session today) */
  session:  AttendanceSession | null;
  /** All segments for the current session */
  segments: AttendanceSegment[];
  /** True during any API call */
  loading:  boolean;
  /** Error message from last action (auto-clears after 5s) */
  error:    string | null;
  /** Actions */
  startWork:  () => Promise<void>;
  pause:      () => Promise<void>;
  resume:     () => Promise<void>;
  endWork:    () => Promise<void>;
  /** Re-fetch from server (e.g. after page focus) */
  refresh:    () => Promise<void>;
}

const IDLE_TIMER: LiveTimerState = {
  status:                     "idle",
  sessionId:                  null,
  totalWorkMs:                0,
  totalBreakMs:               0,
  currentSegmentType:         null,
  currentSegmentStartTime:    null,
  elapsedSinceSegmentStartMs: 0,
};

export function useAttendance(): UseAttendanceReturn {
  const [session,        setSession]        = useState<AttendanceSession | null>(null);
  const [currentSegment, setCurrentSegment] = useState<AttendanceSegment | null>(null);
  const [segments,       setSegments]       = useState<AttendanceSegment[]>([]);
  const [timer,          setTimer]          = useState<LiveTimerState>(IDLE_TIMER);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch current state from server ──────────────────────

  const refresh = useCallback(async () => {
    try {
      const res  = await fetch("/api/attendance");
      const json = await res.json();

      if (!json.success) {
        setSession(null);
        setCurrentSegment(null);
        setSegments([]);
        return;
      }

      const { activeSession, currentSegment: seg, segments: segs } = json.data;

      setSession(activeSession ?? null);
      setCurrentSegment(seg ?? null);
      setSegments(segs ?? []);
    } catch {
      // Silently fail on refresh — timer keeps last known state
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Tick: recalculate live timer every second ───────────

  const tick = useCallback(() => {
    setSession((sess) => {
      setCurrentSegment((seg) => {
        if (!sess || sess.status === "completed") {
          // Completed or no session
          setTimer(
            sess
              ? {
                  status:                     "completed",
                  sessionId:                  sess.id,
                  totalWorkMs:                sess.totalWorkMs,
                  totalBreakMs:               sess.totalBreakMs,
                  currentSegmentType:         null,
                  currentSegmentStartTime:    null,
                  elapsedSinceSegmentStartMs: 0,
                }
              : IDLE_TIMER
          );
          return seg;
        }

        const segType:  SegmentType | null = seg?.type ?? null;
        const segStart: string | null      = seg?.startTime ?? null;

        const { liveWorkMs, liveBreakMs } = computeLiveTotals(
          sess.totalWorkMs,
          sess.totalBreakMs,
          segType,
          segStart
        );

        setTimer({
          status:                     sess.status as SessionStatus,
          sessionId:                  sess.id,
          totalWorkMs:                liveWorkMs,
          totalBreakMs:               liveBreakMs,
          currentSegmentType:         segType,
          currentSegmentStartTime:    segStart,
          elapsedSinceSegmentStartMs: segStart ? elapsedSince(segStart) : 0,
        });

        return seg;
      });
      return sess;
    });
  }, []);

  // ── Start/stop interval ─────────────────────────────────

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    // Tick immediately, then every second
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [tick]);

  // Re-fetch when tab regains focus (handles app refresh)
  useEffect(() => {
    const onFocus = () => { refresh(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  // ── Auto-clear errors after 5 seconds ───────────────────

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(t);
  }, [error]);

  // ── Action dispatcher ───────────────────────────────────

  const dispatch = useCallback(
    async (action: string, sessionId?: string) => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/attendance", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ action, sessionId }),
        });

        const json = await res.json();

        if (!json.success) {
          setError(json.error ?? "Action failed.");
          return;
        }

        const { session: newSession, currentSegment: newSegment } = json.data;

        if (newSession) setSession(newSession);
        if (newSegment !== undefined) setCurrentSegment(newSegment ?? null);

        // Re-fetch to get updated segments list
        await refresh();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Network error.");
      } finally {
        setLoading(false);
      }
    },
    [refresh]
  );

  // ── Public actions ──────────────────────────────────────

  const startWork = useCallback(() => dispatch("start"),                     [dispatch]);
  const pause     = useCallback(() => dispatch("pause",  session?.id),       [dispatch, session]);
  const resume    = useCallback(() => dispatch("resume", session?.id),       [dispatch, session]);
  const endWork   = useCallback(() => dispatch("end",    session?.id),       [dispatch, session]);

  return {
    timer,
    session,
    segments,
    loading,
    error,
    startWork,
    pause,
    resume,
    endWork,
    refresh,
  };
}
