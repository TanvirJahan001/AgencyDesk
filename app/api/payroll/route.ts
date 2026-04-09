/**
 * app/api/payroll/route.ts
 *
 * GET  — List payroll runs (employee: own; admin: all with filters).
 *        Query params: ?status=draft&employeeId=...&period=2026-W15
 *
 * POST — Generate payroll calculation.
 *        Body: { periodType, periodLabel } for all employees, or
 *              { periodType, periodLabel, employeeId } for a single employee.
 */

import { NextRequest } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import type { TimesheetPeriodType } from "@/types";
import {
  getAllPayrollRuns,
  getPayrollRunsByEmployee,
  calculatePayrollForEmployee,
  calculatePayrollForAll,
  findPayrollRun,
  createPayrollRun,
} from "@/lib/payroll/queries";
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
import { validateNonNegative, firstError } from "@/lib/api/validate";

// ── GET ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    if (hasRole(session, "admin", "ceo")) {
      const url        = new URL(req.url);
      const status     = url.searchParams.get("status")     || undefined;
      const employeeId = url.searchParams.get("employeeId") || undefined;
      const period     = url.searchParams.get("period")     || undefined;
      const runs = await getAllPayrollRuns({ status, employeeId, period });
      return ok(runs);
    }

    // Employee: own runs only
    const runs = await getPayrollRunsByEmployee(session.uid);
    return ok(runs);
  } catch (err) {
    return serverError(err);
  }
}

// ── POST ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) return forbidden("Admin access required.");

  const body = await safeParseBody<{
    periodType?:  string;
    periodLabel?: string;
    employeeId?:  string;
    deductions?:  number;
  }>(req);

  const { periodType, periodLabel, employeeId, deductions } = body;

  if (!periodType || !periodLabel) {
    return badRequest("periodType and periodLabel are required.");
  }

  if (!["weekly", "monthly"].includes(periodType)) {
    return badRequest("periodType must be 'weekly' or 'monthly'.");
  }

  // Input validation
  const validationError = deductions != null ? validateNonNegative(deductions, "deductions") : null;
  if (validationError) return badRequest(validationError);

  // Compute date range
  let periodStart: string;
  let periodEnd:   string;

  try {
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
  } catch {
    return badRequest("Invalid periodLabel format.");
  }

  try {
    // Single employee or bulk?
    if (employeeId) {
      const existing = await findPayrollRun(employeeId, periodLabel);
      if (existing) {
        return conflict(
          `Payroll already exists for this employee and period (status: ${existing.status}).`
        );
      }

      const run = await calculatePayrollForEmployee(
        employeeId,
        periodType as TimesheetPeriodType,
        periodLabel,
        periodStart,
        periodEnd,
        session.uid,
        session.name || "Admin",
        null,
        deductions || 0
      );

      if (run.totalWorkMin === 0) {
        return badRequest(
          "No completed attendance sessions found for this employee in the selected period."
        );
      }

      await createPayrollRun(run);
      return ok(run);
    }

    // Bulk: generate for all employees
    const runs = await calculatePayrollForAll(
      periodType as TimesheetPeriodType,
      periodLabel,
      periodStart,
      periodEnd,
      session.uid,
      session.name || "Admin"
    );

    return ok({ generated: runs.length, runs });
  } catch (err) {
    return serverError(err);
  }
}
