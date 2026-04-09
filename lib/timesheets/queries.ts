/**
 * lib/timesheets/queries.ts — Server-side Firestore CRUD for timesheets
 *
 * Used exclusively by API route handlers (Admin SDK).
 * All queries use at most ONE .where() — sorting/filtering done in JS
 * to avoid composite index requirements.
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
 * Single .where() + JS-side periodLabel filter.
 */
export async function findTimesheet(
  employeeId: string,
  periodLabel: string
): Promise<Timesheet | null> {
  const snap = await timesheetsCol()
    .where("employeeId", "==", employeeId)
    .limit(200)
    .get();
  const match = snap.docs.find((d) => d.data().periodLabel === periodLabel);
  return match ? (match.data() as Timesheet) : null;
}

/**
 * Employee: get all my timesheets, newest first.
 * Single .where() + JS-side sort.
 */
export async function getTimesheetsByEmployee(
  employeeId: string,
  limit = 20
): Promise<Timesheet[]> {
  const snap = await timesheetsCol()
    .where("employeeId", "==", employeeId)
    .limit(200)
    .get();
  const results = snap.docs.map((d) => d.data() as Timesheet);
  results.sort((a, b) => (b.periodStart || "").localeCompare(a.periodStart || ""));
  return results.slice(0, limit);
}

/**
 * Admin: get all timesheets with optional filters.
 * Uses at most ONE .where() — rest filtered in JS.
 */
export async function getAllTimesheets(filters?: {
  status?: string;
  employeeId?: string;
  periodType?: string;
}): Promise<Timesheet[]> {
  let snap;

  // Pick the most selective single filter
  if (filters?.employeeId) {
    snap = await timesheetsCol()
      .where("employeeId", "==", filters.employeeId)
      .limit(500)
      .get();
  } else if (filters?.status) {
    snap = await timesheetsCol()
      .where("status", "==", filters.status)
      .limit(500)
      .get();
  } else {
    snap = await timesheetsCol().limit(500).get();
  }

  let results = snap.docs.map((d) => d.data() as Timesheet);

  // JS-side filters for params not used in the Firestore query
  if (filters?.employeeId) results = results.filter((t) => t.employeeId === filters.employeeId);
  if (filters?.status) results = results.filter((t) => t.status === filters.status);
  if (filters?.periodType) results = results.filter((t) => t.periodType === filters.periodType);

  results.sort((a, b) => (b.periodStart || "").localeCompare(a.periodStart || ""));
  return results.slice(0, 100);
}

/**
 * Admin: get submitted timesheets waiting for approval.
 * Single .where() + JS-side sort.
 */
export async function getSubmittedTimesheets(): Promise<Timesheet[]> {
  const snap = await timesheetsCol()
    .where("status", "==", "submitted")
    .limit(500)
    .get();
  const results = snap.docs.map((d) => d.data() as Timesheet);
  results.sort((a, b) => (a.submittedAt || "").localeCompare(b.submittedAt || ""));
  return results;
}

// ── Aggregation ──────────────────────────────────────────────

/**
 * Fetches all completed sessions for an employee within a date range
 * and aggregates them into TimesheetDayEntry records.
 * Single .where() + JS-side date range and status filter.
 */
export async function aggregateSessionsForPeriod(
  employeeId: string,
  periodStart: string,
  periodEnd: string
): Promise<{ days: TimesheetDayEntry[]; totalWorkMs: number; totalBreakMs: number; totalDaysWorked: number }> {
  // Single .where() on userId, filter date range + status in JS.
  const snap = await sessionsCol()
    .where("userId", "==", employeeId)
    .limit(1000)
    .get();

  const sessionsByDate = new Map<string, AttendanceSessionV2[]>();
  for (const doc of snap.docs) {
    const session = doc.data() as AttendanceSessionV2;
    // JS-side filters for date range and status
    if (session.status !== "completed") continue;
    if (session.workDate < periodStart || session.workDate > periodEnd) continue;

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
 * Plain fetch + JS-side sort.
 */
export async function getAllPayrollLocks(): Promise<PayrollLock[]> {
  const snap = await locksCol().limit(200).get();
  const results = snap.docs.map((d) => d.data() as PayrollLock);
  results.sort((a, b) => (b.lockedAt || "").localeCompare(a.lockedAt || ""));
  return results.slice(0, 50);
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
 * Single .where() + JS-side status filter.
 */
export async function lockTimesheetsInPeriod(
  periodLabel: string,
  adminUid: string,
  adminName: string
): Promise<number> {
  const snap = await timesheetsCol()
    .where("periodLabel", "==", periodLabel)
    .limit(500)
    .get();

  const approvedDocs = snap.docs.filter((d) => d.data().status === "approved");
  if (approvedDocs.length === 0) return 0;

  const batch = adminDb.batch();
  const now = new Date().toISOString();

  for (const doc of approvedDocs) {
    batch.update(doc.ref, {
      locked: true,
      lockedAt: now,
      lockedBy: adminUid,
      updatedAt: now,
    });
  }

  await batch.commit();
  return approvedDocs.length;
}
