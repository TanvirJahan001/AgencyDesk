/**
 * app/api/payroll/rates/route.ts
 *
 * GET  — Admin fetches all employees with their rate config.
 * PATCH — Admin updates an employee's hourly rate / OT settings.
 *         Body: { employeeId, hourlyRate?, overtimeMultiplier?, weeklyOvertimeThresholdMin? }
 */

import { NextRequest } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import {
  updateEmployeeRate,
  getAllEmployeesWithRates,
} from "@/lib/payroll/queries";
import {
  safeParseBody,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
  ok,
} from "@/lib/api/helpers";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) return forbidden("Admin access required.");

  try {
    const employees = await getAllEmployeesWithRates();
    return ok(employees);
  } catch (err) {
    return serverError(err);
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) return forbidden("Admin access required.");

  const body = await safeParseBody<{
    employeeId?:                string;
    hourlyRate?:                number;
    overtimeMultiplier?:        number;
    weeklyOvertimeThresholdMin?: number;
  }>(req);

  const { employeeId, hourlyRate, overtimeMultiplier, weeklyOvertimeThresholdMin } = body;

  if (!employeeId) return badRequest("employeeId is required.");

  const updates: Record<string, number> = {};

  if (typeof hourlyRate === "number") {
    if (hourlyRate < 0) return badRequest("hourlyRate cannot be negative.");
    updates.hourlyRate = hourlyRate;
  }

  if (typeof overtimeMultiplier === "number") {
    if (overtimeMultiplier < 1) return badRequest("overtimeMultiplier must be >= 1.");
    updates.overtimeMultiplier = overtimeMultiplier;
  }

  if (typeof weeklyOvertimeThresholdMin === "number") {
    if (weeklyOvertimeThresholdMin < 0) return badRequest("threshold cannot be negative.");
    updates.weeklyOvertimeThresholdMin = weeklyOvertimeThresholdMin;
  }

  if (Object.keys(updates).length === 0) {
    return badRequest("No valid fields to update.");
  }

  try {
    await updateEmployeeRate(employeeId, updates);
    return ok(updates);
  } catch (err) {
    return serverError(err);
  }
}
