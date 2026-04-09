/**
 * GET /api/payroll/weekly
 *
 * Calculate weekly payroll for an employee using the V2 attendance schema.
 * Uses a weekly 40-hour OT threshold (US-style: hours over 40/week are OT).
 *
 * Query params:
 *   weekStart — Monday date YYYY-MM-DD (default: current week Monday)
 *   userId    — target employee uid; employees always see their own data only;
 *               admins/CEOs may pass any userId
 *
 * Success 200:
 *   { success: true, data: WeeklyPayrollResult & { employeeId, hourlyRate } }
 *
 * Error responses:
 *   401 — not authenticated
 *   400 — invalid weekStart date
 *   500 — unexpected server error
 */

import { type NextRequest } from "next/server";
import { verifySessionCookie } from "@/lib/auth/withRoleGuard";
import { getSessionsByRange } from "@/lib/attendance/queries";
import { isValidDate } from "@/lib/attendance/db";
import { calculateWeeklyPayroll, DEFAULT_OT_MULTIPLIER } from "@/lib/payroll/calculator";
import { adminDb } from "@/lib/firebase/admin";
import { unauthorized, badRequest, serverError, ok } from "@/lib/api/helpers";
import type { AppUser } from "@/types";
import type { WeeklyPayrollResult } from "@/lib/payroll/calculator";

const ADMIN_ROLES = new Set(["admin", "ceo"]);
const DEFAULT_HOURLY_RATE = 15; // fallback if employee has no rate set

/** Get Monday of the ISO week containing the given date */
function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay(); // 0 = Sunday, 1 = Monday ...
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Get Sunday (end of week) from a Monday date */
function getSundayOfWeek(mondayStr: string): string {
  const d = new Date(mondayStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

/** Today as YYYY-MM-DD (UTC) */
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  // 1. Authenticate
  const cookie = req.cookies.get("session")?.value;
  if (!cookie) return unauthorized();

  const auth = await verifySessionCookie(cookie);
  if (!auth) return unauthorized();

  // 2. Parse & validate query params
  const { searchParams } = req.nextUrl;
  const weekStartParam = searchParams.get("weekStart");
  const userIdParam    = searchParams.get("userId");

  const weekStart = weekStartParam
    ? getMondayOfWeek(weekStartParam)   // normalise to Monday
    : getMondayOfWeek(todayUTC());

  if (!isValidDate(weekStart)) {
    return badRequest(`Invalid "weekStart" date: "${weekStartParam}". Expected YYYY-MM-DD.`);
  }

  const weekEnd = getSundayOfWeek(weekStart);

  // 3. Resolve target userId
  const isPrivileged = ADMIN_ROLES.has(auth.role ?? "");
  const targetUserId = isPrivileged && userIdParam ? userIdParam : auth.uid;

  try {
    // 4. Fetch employee hourly rate
    const userDoc = await adminDb.collection("users").doc(targetUserId).get();
    const user    = userDoc.exists ? (userDoc.data() as AppUser) : null;
    const hourlyRate        = user?.hourlyRate        ?? DEFAULT_HOURLY_RATE;
    const overtimeMultiplier = user?.overtimeMultiplier ?? DEFAULT_OT_MULTIPLIER;

    // 5. Fetch completed sessions for the week
    const sessions = await getSessionsByRange(targetUserId, weekStart, weekEnd, 14);
    const completed = sessions.filter((s) => s.status === "completed");

    // 6. Calculate weekly payroll (US weekly 40h OT model)
    const result: WeeklyPayrollResult = calculateWeeklyPayroll(
      completed.map((s) => ({
        totalWorkMinutes: s.totalWorkMinutes,
        workDate:         s.workDate,
      })),
      hourlyRate,
      overtimeMultiplier
    );

    return ok({
      ...result,
      employeeId:  targetUserId,
      employeeName: user?.displayName ?? user?.email ?? targetUserId,
      hourlyRate,
      overtimeMultiplier,
      weekStart,
      weekEnd,
    });
  } catch (err) {
    return serverError(err);
  }
}
