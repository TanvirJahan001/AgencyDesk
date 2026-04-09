/**
 * lib/attendance/actions.ts — Attendance State Machine
 *
 * Four server-side functions that implement the full attendance lifecycle.
 * Each function is the single source of truth for one state transition.
 *
 * State machine:
 *   (no session)
 *       ↓  startWork()
 *   "working"
 *       ↓  pauseWork()
 *   "on_break"
 *       ↓  resumeWork()
 *   "working"
 *       ↓  endWork()
 *   "completed"
 *
 * Guarantees:
 *  - Every action writes to Firestore immediately
 *  - Duration is always calculated from saved timestamps, never from frontend state
 *  - Duplicate sessions are prevented at the DB level
 *  - endWork recalculates totals from ALL segments (not accumulated counters alone)
 *  - Firestore doc IDs always equal the stored `id` field
 */

import {
  findOpenSession,
  getOpenSegment,
  getSegmentsBySession,
  createSession,
  updateSession,
  createSegment,
  closeSegment,
} from "./queries";
import {
  newSessionId,
  newSegmentId,
  nowISO,
  todayDate,
  minutesBetween,
} from "./db";
import { calculateOvertimeMinutes } from "@/lib/payroll/calculator";
import type { AttendanceSessionV2 } from "@/types";

// ─── startWork ────────────────────────────────────────────────

/**
 * Start a new work session.
 *
 * Creates:
 *  - One attendance_sessions document (status = "working")
 *  - One attendance_segments document (type = "work", isOpen = true)
 *
 * Throws if the employee already has an open session.
 */
export async function startWork(
  userId: string,
  userName: string
): Promise<AttendanceSessionV2> {
  // Guard: prevent duplicate active sessions
  const existing = await findOpenSession(userId);
  if (existing) {
    throw new Error(
      "You already have an active session. End your current session before starting a new one."
    );
  }

  const now       = nowISO();
  const workDate  = todayDate();
  const sessionId = newSessionId();
  const segmentId = newSegmentId();

  // Build the session document (typed, no casts)
  const session: AttendanceSessionV2 = {
    id:                sessionId,
    userId,
    userName,
    workDate,
    status:            "working",
    clockInAt:         now,
    clockOutAt:        null,
    totalWorkMinutes:  0,
    totalBreakMinutes: 0,
    overtimeMinutes:   0,
    approvedStatus:    "pending",
    createdAt:         now,
    updatedAt:         now,
  };

  // Write both documents — doc(id).set() ensures path ID == stored id field
  await createSession(session);
  await createSegment({
    id:              segmentId,
    sessionId,
    userId,
    type:            "work",
    startAt:         now,
    endAt:           null,
    durationMinutes: 0,
    isOpen:          true,
    createdAt:       now,
  });

  return session;
}

// ─── pauseWork ────────────────────────────────────────────────

/**
 * Pause work and begin a break.
 *
 * Writes:
 *  - Closes the open work segment (endAt, durationMinutes, isOpen=false)
 *  - Creates a new break segment (isOpen = true)
 *  - Updates session: status = "on_break", totalWorkMinutes += elapsed
 *
 * Throws if there is no session currently in "working" status.
 */
export async function pauseWork(
  userId: string
): Promise<AttendanceSessionV2> {
  const session = await findOpenSession(userId);
  if (!session) {
    throw new Error("No active session found. Start work first.");
  }
  if (session.status !== "working") {
    throw new Error(
      `Cannot pause: session status is "${session.status}". You must be working to take a break.`
    );
  }

  const openSeg = await getOpenSegment(session.id);
  if (!openSeg) {
    throw new Error(
      "No open work segment found. Your session data may be inconsistent — please contact an admin."
    );
  }

  const now      = nowISO();
  const duration = minutesBetween(openSeg.startAt, now);

  // Close the work segment
  await closeSegment(openSeg.id, now, duration);

  // Open a new break segment
  const breakId = newSegmentId();
  await createSegment({
    id:              breakId,
    sessionId:       session.id,
    userId,
    type:            "break",
    startAt:         now,
    endAt:           null,
    durationMinutes: 0,
    isOpen:          true,
    createdAt:       now,
  });

  const newWorkMinutes = session.totalWorkMinutes + duration;

  await updateSession(session.id, {
    status:           "on_break",
    totalWorkMinutes: newWorkMinutes,
    updatedAt:        now,
  });

  return {
    ...session,
    status:           "on_break",
    totalWorkMinutes: newWorkMinutes,
    updatedAt:        now,
  };
}

// ─── resumeWork ───────────────────────────────────────────────

/**
 * Resume work after a break.
 *
 * Writes:
 *  - Closes the open break segment
 *  - Creates a new work segment (isOpen = true)
 *  - Updates session: status = "working", totalBreakMinutes += elapsed
 *
 * Throws if there is no session currently in "on_break" status.
 */
export async function resumeWork(
  userId: string
): Promise<AttendanceSessionV2> {
  const session = await findOpenSession(userId);
  if (!session) {
    throw new Error("No paused session found. Start work first.");
  }
  if (session.status !== "on_break") {
    throw new Error(
      `Cannot resume: session status is "${session.status}". You must be on break to resume.`
    );
  }

  const openSeg = await getOpenSegment(session.id);
  if (!openSeg) {
    throw new Error(
      "No open break segment found. Your session data may be inconsistent — please contact an admin."
    );
  }

  const now      = nowISO();
  const duration = minutesBetween(openSeg.startAt, now);

  // Close the break segment
  await closeSegment(openSeg.id, now, duration);

  // Open a new work segment
  const workId = newSegmentId();
  await createSegment({
    id:              workId,
    sessionId:       session.id,
    userId,
    type:            "work",
    startAt:         now,
    endAt:           null,
    durationMinutes: 0,
    isOpen:          true,
    createdAt:       now,
  });

  const newBreakMinutes = session.totalBreakMinutes + duration;

  await updateSession(session.id, {
    status:            "working",
    totalBreakMinutes: newBreakMinutes,
    updatedAt:         now,
  });

  return {
    ...session,
    status:            "working",
    totalBreakMinutes: newBreakMinutes,
    updatedAt:         now,
  };
}

// ─── endWork ─────────────────────────────────────────────────

/**
 * End the current work session.
 *
 * Writes:
 *  - Closes the current open segment (work or break)
 *  - Re-reads ALL segments from Firestore to compute authoritative totals
 *    (never trusts running counters alone — guards against mid-session crashes)
 *  - Updates session: status = "completed", clockOutAt, final totals, overtimeMinutes
 *
 * Throws if there is no active session.
 */
export async function endWork(
  userId: string
): Promise<AttendanceSessionV2> {
  const session = await findOpenSession(userId);
  if (!session) {
    throw new Error("No active session found. You are not currently clocked in.");
  }

  const now = nowISO();

  // Close the currently open segment
  const openSeg = await getOpenSegment(session.id);
  if (openSeg) {
    const duration = minutesBetween(openSeg.startAt, now);
    await closeSegment(openSeg.id, now, duration);
  }

  // ── Recompute totals from ALL segments (authoritative) ──────
  // Reading all segments after closure ensures the final counters are
  // accurate even if the session was interrupted or a previous action failed.
  const allSegments = await getSegmentsBySession(session.id);

  let totalWorkMinutes  = 0;
  let totalBreakMinutes = 0;

  for (const seg of allSegments) {
    const min = seg.durationMinutes ?? 0;
    if (seg.type === "work") {
      totalWorkMinutes  += min;
    } else {
      totalBreakMinutes += min;
    }
  }

  const overtimeMinutes = calculateOvertimeMinutes(totalWorkMinutes);

  await updateSession(session.id, {
    status:            "completed",
    clockOutAt:        now,
    totalWorkMinutes,
    totalBreakMinutes,
    overtimeMinutes,
    updatedAt:         now,
  });

  return {
    ...session,
    status:            "completed",
    clockOutAt:        now,
    totalWorkMinutes,
    totalBreakMinutes,
    overtimeMinutes,
    updatedAt:         now,
  };
}
