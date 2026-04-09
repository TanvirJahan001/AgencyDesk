/**
 * app/api/timesheets/lock/route.ts
 *
 * POST — Admin locks a payroll period. This:
 *   1. Creates a PayrollLock record
 *   2. Marks all approved timesheets in that period as locked
 *   3. Prevents future edits to sessions/timesheets in the range
 *
 * Body: { periodType: "weekly"|"monthly", periodLabel: "2026-W15"|"2026-04" }
 *
 * GET  — List all payroll locks.
 */

import { NextRequest } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import type { PayrollLock, TimesheetPeriodType } from "@/types";
import {
  createPayrollLock,
  findPayrollLock,
  lockTimesheetsInPeriod,
  getAllPayrollLocks,
} from "@/lib/timesheets/queries";
import {
  parseWeekLabel,
  getWeekRange,
  parseMonthLabel,
  getMonthRange,
} from "@/lib/timesheets/utils";
import {
  safeParseBody,
  unauthorized,
  forbidden,
  badRequest,
  conflict,
  serverError,
  ok,
} from "@/lib/api/helpers";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) return forbidden("Admin access required.");

  try {
    const locks = await getAllPayrollLocks();
    return ok(locks);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) return forbidden("Admin access required.");

  const body = await safeParseBody<{
    periodType?:  string;
    periodLabel?: string;
  }>(req);

  const { periodType, periodLabel } = body;

  if (!periodType || !periodLabel) {
    return badRequest("periodType and periodLabel are required.");
  }

  if (!["weekly", "monthly"].includes(periodType)) {
    return badRequest("periodType must be 'weekly' or 'monthly'.");
  }

  try {
    // Check if already locked
    const existingLock = await findPayrollLock(periodLabel);
    if (existingLock) return conflict("This period is already locked.");

    // Compute date range
    let periodStart: string;
    let periodEnd:   string;

    if (periodType === "weekly") {
      const { year, week } = parseWeekLabel(periodLabel);
      const range = getWeekRange(year, week);
      periodStart = range.start;
      periodEnd   = range.end;
    } else {
      const { year, month } = parseMonthLabel(periodLabel);
      const range = getMonthRange(year, month);
      periodStart = range.start;
      periodEnd   = range.end;
    }

    const now    = new Date().toISOString();
    const lockId = `lock_${periodLabel.replace(/[^a-zA-Z0-9]/g, "")}`;

    const lock: PayrollLock = {
      id:           lockId,
      periodType:   periodType as TimesheetPeriodType,
      periodLabel,
      periodStart,
      periodEnd,
      lockedBy:     session.uid,
      lockedByName: session.name || "Admin",
      lockedAt:     now,
    };

    await createPayrollLock(lock);

    const lockedCount = await lockTimesheetsInPeriod(
      periodLabel,
      session.uid,
      session.name || "Admin"
    );

    return ok({ lock, lockedTimesheets: lockedCount });
  } catch (err) {
    return serverError(err);
  }
}
