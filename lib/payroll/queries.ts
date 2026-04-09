/**
 * lib/payroll/queries.ts — Server-side Firestore CRUD + Calculation Engine
 *
 * Used exclusively by API route handlers (Admin SDK).
 */

import { adminDb } from "@/lib/firebase/admin";
import type {
  PayrollRun,
  PayrollDayBreakdown,
  AppUser,
  AttendanceSessionV2,
  TimesheetPeriodType,
} from "@/types";
import {
  msToMinutes,
  calculatePay,
  groupDaysByWeek,
  round2,
  DEFAULT_HOURLY_RATE,
  DEFAULT_OT_MULTIPLIER,
  DEFAULT_WEEKLY_OT_THRESHOLD_MIN,
} from "./utils";

const payrollCol  = () => adminDb.collection("payroll_runs");
const sessionsCol = () => adminDb.collection("attendance_sessions");
const usersCol    = () => adminDb.collection("users");

// ── Payroll CRUD ─────────────────────────────────────────────

export async function createPayrollRun(data: PayrollRun): Promise<PayrollRun> {
  await payrollCol().doc(data.id).set(data);
  return data;
}

export async function getPayrollRun(id: string): Promise<PayrollRun | null> {
  const doc = await payrollCol().doc(id).get();
  return doc.exists ? (doc.data() as PayrollRun) : null;
}

export async function updatePayrollRun(
  id: string,
  data: Partial<PayrollRun>
): Promise<void> {
  await payrollCol().doc(id).update({
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Find existing payroll run for employee + period.
 */
export async function findPayrollRun(
  employeeId: string,
  period: string
): Promise<PayrollRun | null> {
  const snap = await payrollCol()
    .where("employeeId", "==", employeeId)
    .where("period", "==", period)
    .limit(1)
    .get();
  return snap.empty ? null : (snap.docs[0].data() as PayrollRun);
}

/**
 * Admin: get all payroll runs with optional filters.
 */
export async function getAllPayrollRuns(filters?: {
  status?: string;
  employeeId?: string;
  period?: string;
}): Promise<PayrollRun[]> {
  let query: FirebaseFirestore.Query = payrollCol()
    .orderBy("createdAt", "desc");

  if (filters?.employeeId && filters?.status) {
    query = payrollCol()
      .where("employeeId", "==", filters.employeeId)
      .where("status", "==", filters.status)
      .orderBy("createdAt", "desc");
  } else if (filters?.employeeId) {
    query = payrollCol()
      .where("employeeId", "==", filters.employeeId)
      .orderBy("createdAt", "desc");
  } else if (filters?.status) {
    query = payrollCol()
      .where("status", "==", filters.status)
      .orderBy("createdAt", "desc");
  }

  if (filters?.period) {
    // period filter is applied in-memory since we already
    // might have employeeId+status compound query
    const snap = await query.limit(200).get();
    return snap.docs
      .map((d) => d.data() as PayrollRun)
      .filter((r) => r.period === filters.period);
  }

  const snap = await query.limit(100).get();
  return snap.docs.map((d) => d.data() as PayrollRun);
}

/**
 * Employee: get own payroll runs.
 */
export async function getPayrollRunsByEmployee(
  employeeId: string
): Promise<PayrollRun[]> {
  const snap = await payrollCol()
    .where("employeeId", "==", employeeId)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();
  return snap.docs.map((d) => d.data() as PayrollRun);
}

// ── Calculation Engine ───────────────────────────────────────

/**
 * Generates a full PayrollRun for one employee in a given period.
 *
 * Steps:
 *  1. Fetch the employee profile for rate config
 *  2. Fetch all completed attendance_sessions in the date range
 *  3. Build per-day breakdown (ms → minutes)
 *  4. Group days into ISO weeks for OT calculation
 *  5. Calculate regular/OT pay
 *  6. Return the PayrollRun object (caller persists it)
 */
export async function calculatePayrollForEmployee(
  employeeId: string,
  periodType: TimesheetPeriodType,
  period: string,
  periodStart: string,
  periodEnd: string,
  adminUid: string,
  adminName: string,
  timesheetId: string | null = null,
  deductions = 0
): Promise<PayrollRun> {
  // 1. Employee profile
  const userDoc = await usersCol().doc(employeeId).get();
  const user = userDoc.exists ? (userDoc.data() as AppUser) : null;

  const hourlyRate         = user?.hourlyRate ?? DEFAULT_HOURLY_RATE;
  const overtimeMultiplier = user?.overtimeMultiplier ?? DEFAULT_OT_MULTIPLIER;
  const weeklyOtThresholdMin = user?.weeklyOvertimeThresholdMin ?? DEFAULT_WEEKLY_OT_THRESHOLD_MIN;
  const employeeName       = user?.displayName ?? "Unknown";

  // 2. Fetch completed sessions in range  (V2 schema: userId + workDate)
  const snap = await sessionsCol()
    .where("userId", "==", employeeId)
    .where("workDate", ">=", periodStart)
    .where("workDate", "<=", periodEnd)
    .where("status", "==", "completed")
    .get();

  const sessions = snap.docs.map((d) => d.data() as AttendanceSessionV2);

  // 3. Build per-day breakdown
  const dayMap = new Map<string, { workMin: number; sessionIds: string[] }>();

  for (const s of sessions) {
    const existing = dayMap.get(s.workDate) || { workMin: 0, sessionIds: [] };
    // V2 stores minutes directly (no ms conversion needed)
    existing.workMin += s.totalWorkMinutes;
    existing.sessionIds.push(s.id);
    dayMap.set(s.workDate, existing);
  }

  const dailyBreakdown: PayrollDayBreakdown[] = [];
  let totalWorkMin = 0;

  // Generate entries for every day in the range
  const cur = new Date(periodStart + "T00:00:00Z");
  const end = new Date(periodEnd + "T00:00:00Z");
  while (cur <= end) {
    const dateStr = cur.toISOString().slice(0, 10);
    const entry = dayMap.get(dateStr);
    const workMin = round2(entry?.workMin ?? 0);
    totalWorkMin += workMin;
    dailyBreakdown.push({
      date: dateStr,
      workMin,
      sessionIds: entry?.sessionIds ?? [],
    });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  // 4. Group into weeks for OT
  const weeklyMinutes = groupDaysByWeek(dailyBreakdown);

  // 5. Calculate pay
  const payResult = calculatePay({
    totalWorkMin,
    hourlyRate,
    overtimeMultiplier,
    weeklyOtThresholdMin: weeklyOtThresholdMin,
    weeklyMinutes,
  });

  const netPay = round2(payResult.grossPay - deductions);
  const now = new Date().toISOString();
  const id = `pr_${employeeId}_${period.replace(/[^a-zA-Z0-9]/g, "")}`;

  return {
    id,
    employeeId,
    employeeName,
    period,
    periodType,
    periodStart,
    periodEnd,
    timesheetId,

    hourlyRate,
    overtimeMultiplier,
    weeklyOtThresholdMin: weeklyOtThresholdMin,

    totalWorkMin: round2(totalWorkMin),
    regularMin: payResult.regularMin,
    overtimeMin: payResult.overtimeMin,

    regularPay: payResult.regularPay,
    overtimePay: payResult.overtimePay,
    grossPay: payResult.grossPay,
    deductions,
    netPay,

    dailyBreakdown,

    status: "draft",
    calculatedAt: now,
    processedAt: null,
    paidAt: null,
    createdBy: adminUid,
    createdByName: adminName,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Bulk generate payroll for ALL employees in a period.
 * Returns the list of generated PayrollRun objects.
 */
export async function calculatePayrollForAll(
  periodType: TimesheetPeriodType,
  period: string,
  periodStart: string,
  periodEnd: string,
  adminUid: string,
  adminName: string
): Promise<PayrollRun[]> {
  // Fetch all employees
  const usersSnap = await usersCol()
    .where("role", "==", "employee")
    .get();

  const runs: PayrollRun[] = [];

  for (const doc of usersSnap.docs) {
    const user = doc.data() as AppUser;

    // Skip if already has a payroll run for this period
    const existing = await findPayrollRun(user.uid, period);
    if (existing) {
      runs.push(existing);
      continue;
    }

    const run = await calculatePayrollForEmployee(
      user.uid,
      periodType,
      period,
      periodStart,
      periodEnd,
      adminUid,
      adminName
    );

    // Only create if employee has any work
    if (run.totalWorkMin > 0) {
      await createPayrollRun(run);
      runs.push(run);
    }
  }

  return runs;
}

// ── Employee rate management ─────────────────────────────────

/**
 * Update an employee's payroll rate configuration.
 */
export async function updateEmployeeRate(
  employeeId: string,
  rates: {
    hourlyRate?: number;
    overtimeMultiplier?: number;
    weeklyOvertimeThresholdMin?: number;
  }
): Promise<void> {
  await usersCol().doc(employeeId).update(rates);
}

/**
 * Fetch all employees with their rate config.
 */
export async function getAllEmployeesWithRates(): Promise<AppUser[]> {
  const snap = await usersCol()
    .where("role", "==", "employee")
    .get();
  return snap.docs.map((d) => d.data() as AppUser);
}
