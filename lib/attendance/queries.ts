/**
 * lib/attendance/queries.ts — Firestore Query Functions
 *
 * All read/write operations on attendance_sessions and attendance_segments.
 *
 * ── ID contract (critical) ────────────────────────────────────
 * Every document is created with `col.doc(id).set(data)` so the
 * Firestore document path ID always equals the stored `id` field.
 * This means `col.doc(session.id).update(...)` always hits the right doc.
 * ──────────────────────────────────────────────────────────────
 */

import { sessionsCol, segmentsCol } from "./db";
import type { AttendanceSessionV2, AttendanceSegmentV2 } from "@/types";

// ─── Types ────────────────────────────────────────────────────

/** Full segment data including the isOpen helper field */
export type SegmentDoc = AttendanceSegmentV2 & { isOpen: boolean };

// ─── Session reads ────────────────────────────────────────────

/**
 * Find the single open session (status "working" or "on_break") for a user.
 * Returns null if the employee is not currently clocked in.
 */
export async function findOpenSession(
  userId: string
): Promise<AttendanceSessionV2 | null> {
  try {
    const snap = await sessionsCol()
      .where("userId", "==", userId)
      .where("status", "in", ["working", "on_break"])
      .limit(1)
      .get();

    if (snap.empty) return null;
    const doc = snap.docs[0];
    // Always return doc.id as the canonical id so updates never miss
    return { ...(doc.data() as AttendanceSessionV2), id: doc.id };
  } catch (err) {
    throw new Error(
      `findOpenSession failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Fetch a session by its Firestore document ID.
 */
export async function getSessionById(
  id: string
): Promise<AttendanceSessionV2 | null> {
  try {
    const doc = await sessionsCol().doc(id).get();
    if (!doc.exists) return null;
    return { ...(doc.data() as AttendanceSessionV2), id: doc.id };
  } catch (err) {
    throw new Error(
      `getSessionById failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Get the first completed session for a specific work date for a user.
 */
export async function getSessionByDate(
  userId: string,
  workDate: string
): Promise<AttendanceSessionV2 | null> {
  try {
    const snap = await sessionsCol()
      .where("userId", "==", userId)
      .where("workDate", "==", workDate)
      .limit(1)
      .get();

    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { ...(doc.data() as AttendanceSessionV2), id: doc.id };
  } catch (err) {
    throw new Error(
      `getSessionByDate failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Get all sessions for a user within a date range [fromDate, toDate] inclusive.
 * Sorted newest-first (in-process sort avoids a Firestore composite index).
 */
export async function getSessionsByRange(
  userId: string,
  fromDate: string,
  toDate: string,
  limit = 200
): Promise<AttendanceSessionV2[]> {
  try {
    const snap = await sessionsCol()
      .where("userId", "==", userId)
      .where("workDate", ">=", fromDate)
      .where("workDate", "<=", toDate)
      .limit(limit)
      .get();

    return snap.docs
      .map((d) => ({ ...(d.data() as AttendanceSessionV2), id: d.id }))
      .sort((a, b) => b.workDate.localeCompare(a.workDate));
  } catch (err) {
    throw new Error(
      `getSessionsByRange failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Get all currently-open sessions across ALL employees (admin dashboard).
 */
export async function getAllActiveSessions(): Promise<AttendanceSessionV2[]> {
  try {
    const snap = await sessionsCol()
      .where("status", "in", ["working", "on_break"])
      .get();
    return snap.docs.map((d) => ({
      ...(d.data() as AttendanceSessionV2),
      id: d.id,
    }));
  } catch (err) {
    throw new Error(
      `getAllActiveSessions failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Get all sessions for a specific work date across ALL employees.
 */
export async function getAllSessionsByDate(
  workDate: string
): Promise<AttendanceSessionV2[]> {
  try {
    const snap = await sessionsCol()
      .where("workDate", "==", workDate)
      .get();
    return snap.docs.map((d) => ({
      ...(d.data() as AttendanceSessionV2),
      id: d.id,
    }));
  } catch (err) {
    throw new Error(
      `getAllSessionsByDate failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

// ─── Segment reads ────────────────────────────────────────────

/**
 * Get the single currently-open segment for a session.
 *
 * Strategy: query `isOpen == true` first (reliable, indexed).
 * Falls back to `endAt == null` for documents written before the isOpen field existed.
 */
export async function getOpenSegment(
  sessionId: string
): Promise<SegmentDoc | null> {
  try {
    // Primary: use isOpen flag
    const primary = await segmentsCol()
      .where("sessionId", "==", sessionId)
      .where("isOpen", "==", true)
      .limit(1)
      .get();

    if (!primary.empty) {
      const doc = primary.docs[0];
      return { ...(doc.data() as SegmentDoc), id: doc.id };
    }

    // Fallback: endAt == null (for pre-existing data)
    const fallback = await segmentsCol()
      .where("sessionId", "==", sessionId)
      .where("endAt", "==", null)
      .limit(1)
      .get();

    if (fallback.empty) return null;
    const doc = fallback.docs[0];
    return { ...(doc.data() as SegmentDoc), id: doc.id };
  } catch (err) {
    throw new Error(
      `getOpenSegment failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Get all segments for a session, sorted chronologically by startAt.
 */
export async function getSegmentsBySession(
  sessionId: string
): Promise<SegmentDoc[]> {
  try {
    const snap = await segmentsCol()
      .where("sessionId", "==", sessionId)
      .get();

    return snap.docs
      .map((d) => ({ ...(d.data() as SegmentDoc), id: d.id }))
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
  } catch (err) {
    throw new Error(
      `getSegmentsBySession failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Get a segment by its Firestore document ID.
 */
export async function getSegmentById(
  id: string
): Promise<SegmentDoc | null> {
  try {
    const doc = await segmentsCol().doc(id).get();
    if (!doc.exists) return null;
    return { ...(doc.data() as SegmentDoc), id: doc.id };
  } catch (err) {
    throw new Error(
      `getSegmentById failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Get all sessions across ALL employees within a date range.
 * Optionally filter by status and/or a specific userId.
 * Used by admin/CEO pages to render the full attendance table.
 *
 * sorted newest-first by workDate then by clockInAt descending.
 */
export async function getAllSessionsByRange(
  fromDate: string,
  toDate:   string,
  limit     = 500,
  status?:  string,
  userId?:  string
): Promise<AttendanceSessionV2[]> {
  try {
    let query: FirebaseFirestore.Query = sessionsCol()
      .where("workDate", ">=", fromDate)
      .where("workDate", "<=", toDate);

    if (userId) query = query.where("userId", "==", userId);
    if (status) query = query.where("status", "==", status);

    const snap = await query.limit(limit).get();

    return snap.docs
      .map((d) => ({ ...(d.data() as AttendanceSessionV2), id: d.id }))
      .sort((a, b) => {
        const dateComp = b.workDate.localeCompare(a.workDate);
        if (dateComp !== 0) return dateComp;
        return (b.clockInAt ?? "").localeCompare(a.clockInAt ?? "");
      });
  } catch (err) {
    throw new Error(
      `getAllSessionsByRange failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

// ─── Session writes ───────────────────────────────────────────

/**
 * Create a new session document.
 * Uses `doc(data.id).set()` so the Firestore doc ID matches data.id exactly.
 */
export async function createSession(
  data: AttendanceSessionV2
): Promise<void> {
  try {
    await sessionsCol().doc(data.id).set(data);
  } catch (err) {
    throw new Error(
      `createSession failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Update specific fields on a session document.
 */
export async function updateSession(
  id: string,
  data: Partial<AttendanceSessionV2>
): Promise<void> {
  try {
    await sessionsCol().doc(id).update(data as Record<string, unknown>);
  } catch (err) {
    throw new Error(
      `updateSession failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

// ─── Segment writes ───────────────────────────────────────────

/**
 * Create a new segment document.
 * Uses `doc(data.id).set()` so the Firestore doc ID matches data.id exactly.
 * The `isOpen: true` field enables efficient open-segment queries.
 */
export async function createSegment(
  data: AttendanceSegmentV2 & { isOpen: boolean }
): Promise<void> {
  try {
    await segmentsCol().doc(data.id).set(data);
  } catch (err) {
    throw new Error(
      `createSegment failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Close an open segment: write endAt, durationMinutes, and clear isOpen flag.
 */
export async function closeSegment(
  id: string,
  endAt: string,
  durationMinutes: number
): Promise<void> {
  try {
    await segmentsCol()
      .doc(id)
      .update({ endAt, durationMinutes, isOpen: false });
  } catch (err) {
    throw new Error(
      `closeSegment failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
