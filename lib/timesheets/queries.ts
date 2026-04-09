/**
 * lib/timesheets/queries.ts — Server-side Firestore CRUD for timesheets
 *
 * Used exclusively by API route handlers (Admin SDK).
 */

import { adminDb } from "@/lib/firebase/admin";
import type {
  Timesheet,
  TimesheetDayEntry,
  TimesheetPeriodType,
  PayrollLock,
  AttendanceSessionV2,
} from "@/types";
import { dateRange } from "./utils";

const timesheetsCol = () => adminDb.collection("timesheets");
const sessionsCol   = () => adminDb.collection("attendance_sessions");
const locksCol      = () => adminDb.collection("payroll_locks");

// ── Timesheet CRUD ───────────────────────────────────────────

export async function createTimesheet(data: Timesheet): Promise<Timesheet> {
  await timesheetsCol().doc(data.id).set(data);
  return data;
}

export async function getTimesheet(id: string): Promise<Timesheet | null> {
  const doc = await timesheetsCol().doc(id).get();
  return doc.exists ? (doc.data() as Timesheet) : null;
}

export async function updateTimesheet(
  id: string,
  data: Partial<Timesheet>
): Promise<void> {
  await timesheetsCol().doc(id).update({
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Find an existing timesheet for an employee + period.
 */
export async function findTimesheet(
  employeeId: string,
  periodLabel: string
): Promise<Timesheet | null> {
  const snap = await timesheetsCol()
    .where("employeeId", "==", employeeId)
    .where("periodLabel", "==", periodLabel)
    .limit(1)
    .get();
  return snap.empty ? null : (snap.docs[0].data() as Timesheet);
}

/**
 * Employee: get all my timesheets, newest first.
 */
export async function getTimesheetsByEmployee(
  employeeId: string,
  limit = 20
): Promise<Timesheet[]> {
  const snap = await timesheetsCol()
    .where("employeeId", "==", employeeId)
    .orderBy("periodStart", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data() as Timesheet);
}

/**
 * Admin: get all timesheets with optional filters.
 */
export async function getAllTimesheets(filters?: {
  status?: string;
  employeeId?: string;
  periodType?: string;
}): Promise<Timesheet[]> {
  let query: FirebaseFirestore.Query = timesheetsCol()
    .orderBy("periodStart", "desc");

  if (filters?.employeeId) {
    query = timesheetsCol()
      .where("employeeId", "==", filters.employeeId)
      .orderBy("periodStart", "desc");
  }

  if (filters?.status) {
    // Need a fresh query with both filters
    if (filters?.employeeId) {
      query = timesheetsCol()
        .where("employeeId", "==", filters.employeeId)
        .where("status", "==", filters.status)
        .orderBy("periodStart", "desc");
    } else {
      query = timesheetsCol()
        .where("status", "==", filters.status)
        .orderBy("periodStart", "desc");
    }
  }

  const snap = await query.limit(100).get();
  return snap.docs.map((d) => d.data() as Timesheet);
}

/**
 * Admin: get submitted timesheets waiting for approval.
 */
export async function getSubmittedTimesheets(): Promise<Timesheet[]> {
  const snap = await timesheetsCol()
    .where("status", "==", "submitted")
    .orderBy("submittedAt", "asc")
    .get();
  return snap.docs.map((d) => d.data() as Timesheet);
}

// ── Aggregation ──────────────────────────────────────────────

/**
 * Fetches all completed sessions for an employee within a date range
 * and aggregates them into TimesheetDayEntry records.
 */
export async function aggregateSessionsForPeriod(
  employeeId: string,
  periodStart: string,
  periodEnd: string
): Promise<{ days: TimesheetDayEntry[]; totalWorkMs: number; totalBreakMs: number; totalDaysWorked: number }> {
  // Fetch all completed sessions within the date range (V2 schema: userId + workDate)
  const snap = await sessionsCol()
    .where("userId", "==", employeeId)
    .where("workDate", ">=", periodStart)
    .where("workDate", "<=", periodEnd)
    .where("status", "==", "completed")
    .get();

  const sessionsByDate = new Map<string, AttendanceSessionV2[]>();
  for (const doc of snap.docs) {
    const session = doc.data() as AttendanceSessionV2;
    const existing = sessionsByDate.get(session.workDate) || [];
    existing.push(session);
    sessionsByDate.set(session.workDate, existing);
  }

  const allDates = dateRange(periodStart, periodEnd);
  let totalWorkMs = 0;
  let totalBreakMs = 0;
  let totalDaysWorked = 0;

  const days: TimesheetDayEntry[] = allDates.map((date) => {
    const sessions = sessionsByDate.get(date) || [];
    if (sessions.length === 0) {
      return {
        date,
        sessionIds: [],
        totalWorkMs: 0,
        totalBreakMs: 0,
        status: "absent" as const,
      };
    }

    // V2 stores minutes → convert to ms for Timesheet compatibility
    const dayWorkMs  = sessions.reduce((sum, s) => sum + (s.totalWorkMinutes  * 60_000), 0);
    const dayBreakMs = sessions.reduce((sum, s) => sum + (s.totalBreakMinutes * 60_000), 0);
    totalWorkMs += dayWorkMs;
    totalBreakMs += dayBreakMs;
    totalDaysWorked++;

    return {
      date,
      sessionIds: sessions.map((s) => s.id),
      totalWorkMs: dayWorkMs,
      totalBreakMs: dayBreakMs,
      status: "completed" as const,
    };
  });

  return { days, totalWorkMs, totalBreakMs, totalDaysWorked };
}

// ── Payroll Locks ────────────────────────────────────────────

export async function createPayrollLock(data: PayrollLock): Promise<PayrollLock> {
  await locksCol().doc(data.id).set(data);
  return data;
}

export async function getPayrollLock(id: string): Promise<PayrollLock | null> {
  const doc = await locksCol().doc(id).get();
  return doc.exists ? (doc.data() as PayrollLock) : null;
}

/**
 * Check if a period is locked.
 */
export async function findPayrollLock(
  periodLabel: string
): Promise<PayrollLock | null> {
  const snap = await locksCol()
    .where("periodLabel", "==", periodLabel)
    .limit(1)
    .get();
  return snap.empty ? null : (snap.docs[0].data() as PayrollLock);
}

/**
 * Get all payroll locks, newest first.
 */
export async function getAllPayrollLocks(): Promise<PayrollLock[]> {
  const snap = await locksCol()
    .orderBy("lockedAt", "desc")
    .limit(50)
    .get();
  return snap.docs.map((d) => d.data() as PayrollLock);
}

/**
 * Check if a specific date falls within any locked period.
 */
export async function isDateLocked(date: string): Promise<boolean> {
  const snap = await locksCol()
    .where("periodStart", "<=", date)
    .get();

  for (const doc of snap.docs) {
    const lock = doc.data() as PayrollLock;
    if (date >= lock.periodStart && date <= lock.periodEnd) {
      return true;
    }
  }
  return false;
}

/**
 * Lock all timesheets within a period. Uses a batch write.
 */
export async function lockTimesheetsInPeriod(
  periodLabel: string,
  adminUid: string,
  adminName: string
): Promise<number> {
  const snap = await timesheetsCol()
    .where("periodLabel", "==", periodLabel)
    .where("status", "==", "approved")
    .get();

  if (snap.empty) return 0;

  const batch = adminDb.batch();
  const now = new Date().toISOString();

  for (const doc of snap.docs) {
    batch.update(doc.ref, {
      locked: true,
      lockedAt: now,
      lockedBy: adminUid,
      updatedAt: now,
    });
  }

  await batch.commit();
  return snap.size;
}
