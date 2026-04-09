/**
 * app/api/timesheets/route.ts
 *
 * GET  — Employee: list own timesheets.  Admin: list all (with filters).
 * POST — Generate (or refresh) a timesheet for a given period.
 *         Body: { periodType: "weekly"|"monthly", periodLabel: "2026-W15"|"2026-04" }
 *         Optionally pass { action: "submit", timesheetId } to submit.
 */

import { NextRequest } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import type { Timesheet, TimesheetPeriodType } from "@/types";
import {
  createTimesheet,
  findTimesheet,
  updateTimesheet,
  getTimesheetsByEmployee,
  getAllTimesheets,
  aggregateSessionsForPeriod,
  findPayrollLock,
} from "@/lib/timesheets/queries";
import {
  parseWeekLabel,
  getWeekRange,
  parseMonthLabel,
  getMonthRange,
  weekLabel,
  monthLabel,
} from "@/lib/timesheets/utils";
import {
  safeParseBody,
  unauthorized,
  forbidden,
  badRequest,
  notFound,
  serverError,
  ok,
} from "@/lib/api/helpers";

// ── GET ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const url        = new URL(req.url);
    const status     = url.searchParams.get("status")     || undefined;
    const employeeId = url.searchParams.get("employeeId") || undefined;

    if (hasRole(session, "admin", "ceo")) {
      const timesheets = await getAllTimesheets({ status, employeeId });
      return ok(timesheets);
    }

    // Employee: own timesheets
    const timesheets = await getTimesheetsByEmployee(session.uid);
    return ok(timesheets);
  } catch (err) {
    return serverError(err);
  }
}

// ── POST ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await safeParseBody<{
    action?:       string;
    timesheetId?:  string;
    periodType?:   string;
    periodLabel?:  string;
    date?:         string;
  }>(req);

  if (body.action === "submit") {
    return handleSubmit(body, session.uid);
  }

  return handleGenerate(body, session);
}

// ── Handlers ─────────────────────────────────────────────────

async function handleGenerate(
  body: { periodType?: string; periodLabel?: string; date?: string },
  session: { uid: string; name?: string; role: string }
) {
  try {
    let periodType: TimesheetPeriodType = "weekly";
    let periodLabel: string;
    let periodStart: string;
    let periodEnd: string;

    if (body.periodType === "monthly") {
      periodType = "monthly";
    }

    // If a date is given, compute the period from it
    if (body.date) {
      const d = new Date(body.date);
      if (periodType === "weekly") {
        periodLabel = weekLabel(d);
        const { year, week } = parseWeekLabel(periodLabel);
        const range = getWeekRange(year, week);
        periodStart = range.start;
        periodEnd   = range.end;
      } else {
        periodLabel = monthLabel(d);
        const { year, month } = parseMonthLabel(periodLabel);
        const range = getMonthRange(year, month);
        periodStart = range.start;
        periodEnd   = range.end;
      }
    } else if (body.periodLabel) {
      periodLabel = body.periodLabel;
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
    } else {
      return badRequest("Provide periodLabel or date.");
    }

    // Check if period is locked
    const lock = await findPayrollLock(periodLabel);
    if (lock) {
      return forbidden("This period is locked and cannot be modified.");
    }

    const employeeId   = session.uid;
    const employeeName = session.name || "Unknown";

    // Check for existing timesheet
    const existing = await findTimesheet(employeeId, periodLabel);

    if (existing && (existing.status === "approved" || existing.locked)) {
      return forbidden("Cannot regenerate an approved or locked timesheet.");
    }

    // Aggregate sessions
    const aggregation = await aggregateSessionsForPeriod(employeeId, periodStart, periodEnd);

    if (existing) {
      // Refresh existing draft/rejected timesheet
      if (existing.status === "submitted") {
        return badRequest(
          "Cannot refresh a submitted timesheet. Ask admin to reject first."
        );
      }

      await updateTimesheet(existing.id, {
        days:            aggregation.days,
        totalWorkMs:     aggregation.totalWorkMs,
        totalBreakMs:    aggregation.totalBreakMs,
        totalDaysWorked: aggregation.totalDaysWorked,
        status:          "draft",
      });

      return ok({ ...existing, ...aggregation, status: "draft" as const });
    }

    // Create new timesheet
    const id  = `ts_${employeeId}_${periodLabel.replace(/[^a-zA-Z0-9]/g, "")}`;
    const now = new Date().toISOString();

    const timesheet: Timesheet = {
      id,
      employeeId,
      employeeName,
      periodType,
      periodLabel,
      periodStart,
      periodEnd,
      days:            aggregation.days,
      totalWorkMs:     aggregation.totalWorkMs,
      totalBreakMs:    aggregation.totalBreakMs,
      totalDaysWorked: aggregation.totalDaysWorked,
      status:          "draft",
      submittedAt:     null,
      reviewedBy:      null,
      reviewerName:    null,
      reviewNote:      null,
      reviewedAt:      null,
      locked:          false,
      lockedAt:        null,
      lockedBy:        null,
      createdAt:       now,
      updatedAt:       now,
    };

    await createTimesheet(timesheet);
    return ok(timesheet);
  } catch (err) {
    return serverError(err);
  }
}

async function handleSubmit(
  body: { timesheetId?: string },
  employeeUid: string
) {
  if (!body.timesheetId) {
    return badRequest("timesheetId is required.");
  }

  try {
    const { getTimesheet: fetchTs } = await import("@/lib/timesheets/queries");
    const ts = await fetchTs(body.timesheetId);

    if (!ts) return notFound("Timesheet not found.");

    if (ts.employeeId !== employeeUid) {
      return forbidden("Not your timesheet.");
    }

    if (ts.locked) {
      return forbidden("Timesheet is locked.");
    }

    if (ts.status !== "draft" && ts.status !== "rejected") {
      return badRequest(`Cannot submit a timesheet with status "${ts.status}".`);
    }

    if (ts.totalDaysWorked === 0) {
      return badRequest("Cannot submit an empty timesheet (no worked days).");
    }

    await updateTimesheet(ts.id, {
      status:      "submitted",
      submittedAt: new Date().toISOString(),
    });

    return ok({ ...ts, status: "submitted" });
  } catch (err) {
    return serverError(err);
  }
}
