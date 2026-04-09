/**
 * GET /api/payroll/monthly
 *
 * Calculate monthly payroll for an employee using the V2 attendance schema.
 * Uses daily OT threshold (any day over 8h = overtime), summed across the month.
 *
 * Query params:
 *   month   — YYYY-MM (default: current month)
 *   userId  — target employee uid; employees always see their own data only;
 *              admins/CEOs may pass any userId
 *
 * Success 200:
 *   { success: true, data: MonthlyPayrollResult & { employeeId, hourlyRate } }
 *
 * Error responses:
 *   401 — not authenticated
 *   400 — invalid month format
 *   500 — unexpected server error
 */

import { type NextRequest } from "next/server";
import { verifySessionCookie } from "@/lib/auth/withRoleGuard";
import { getSessionsByRange } from "@/lib/attendance/queries";
import { isValidMonth } from "@/lib/attendance/db";
import { calculatePeriodPayroll, DEFAULT_OT_MULTIPLIER } from "@/lib/payroll/calculator";
import { adminDb } from "@/lib/firebase/admin";
import { unauthorized, badRequest, serverError, ok } from "@/lib/api/helpers";
import type { AppUser } from "@/types";
import type { MonthlyPayrollResult } from "@/lib/payroll/calculator";

const ADMIN_ROLES = new Set(["admin", "ceo"]);
const DEFAULT_HOURLY_RATE = 15; // fallback if employee has no rate set

/** Current month as YYYY-MM */
function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** First day of a given YYYY-MM month: YYYY-MM-01 */
function monthStart(month: string): string {
  return `${month}-01`;
}

/** Last day of a given YYYY-MM month: YYYY-MM-DD */
function monthEnd(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  // Day 0 of next month = last day of current month
  const last = new Date(Date.UTC(year, mon, 0)); // mon is already 1-based; Date uses 0-based
  return last.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  // 1. Authenticate
  const cookie = req.cookies.get("session")?.value;
  if (!cookie) return unauthorized();

  const auth = await verifySessionCookie(cookie);
  if (!auth) return unauthorized();

  // 2. Parse & validate query params
  const { searchParams } = req.nextUrl;
  const monthParam  = searchParams.get("month");
  const userIdParam = searchParams.get("userId");

  const month = monthParam ?? currentMonth();

  if (!isValidMonth(month)) {
    return badRequest(`Invalid "month" value: "${monthParam}". Expected YYYY-MM.`);
  }

  const periodStart = monthStart(month);
  const periodEnd   = monthEnd(month);

  // 3. Resolve target userId
  const isPrivileged = ADMIN_ROLES.has(auth.role ?? "");
  const targetUserId = isPrivileged && userIdParam ? userIdParam : auth.uid;

  try {
    // 4. Fetch employee hourly rate
    const userDoc = await adminDb.collection("users").doc(targetUserId).get();
    const user    = userDoc.exists ? (userDoc.data() as AppUser) : null;
    const hourlyRate         = user?.hourlyRate         ?? DEFAULT_HOURLY_RATE;
    const overtimeMultiplier = user?.overtimeMultiplier ?? DEFAULT_OT_MULTIPLIER;

    // 5. Fetch completed sessions for the month
    const sessions = await getSessionsByRange(targetUserId, periodStart, periodEnd, 200);
    const completed = sessions.filter((s) => s.status === "completed");

    // 6. Calculate monthly payroll (daily OT model: each day > 8h = OT for that day)
    const result = calculatePeriodPayroll(
      completed.map((s) => ({
        totalWorkMinutes: s.totalWorkMinutes,
        workDate:         s.workDate,
      })),
      hourlyRate,
      overtimeMultiplier,
      "Monthly"
    );

    const monthlyResult: MonthlyPayrollResult = {
      ...result,
      monthStart: periodStart,
      monthEnd:   periodEnd,
    };

    return ok({
      ...monthlyResult,
      employeeId:          targetUserId,
      employeeName:        user?.displayName ?? user?.email ?? targetUserId,
      hourlyRate,
      overtimeMultiplier,
      month,
    });
  } catch (err) {
    return serverError(err);
  }
}
