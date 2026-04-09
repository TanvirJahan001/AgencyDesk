/**
 * app/api/schedules/route.ts
 *
 * GET   — List employee schedules. All authenticated.
 *         Optional query: ?employeeId=<uid> to filter by employee.
 * POST  — Assign a schedule to an employee. Admin/CEO only.
 *         Required: employeeId, shiftTemplateId, startDate.
 *         Optional: endDate.
 */

import { NextRequest } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import {
  safeParseBody,
  unauthorized,
  forbidden,
  badRequest,
  notFound,
  serverError,
  ok,
} from "@/lib/api/helpers";
import type { EmployeeSchedule, ShiftTemplate, AppUser } from "@/types";

// ── GET ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const employeeId = req.nextUrl.searchParams.get("employeeId");

    let query = adminDb.collection("employee_schedules") as any;
    if (employeeId) {
      query = query.where("employeeId", "==", employeeId);
    }

    const snap = await query.get();
    const schedules = snap.docs.map((d) => d.data() as EmployeeSchedule);
    return ok(schedules);
  } catch (err) {
    return serverError(err);
  }
}

// ── POST ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) return forbidden("Admin or CEO access required.");

  const body = await safeParseBody<{
    employeeId?: string;
    shiftTemplateId?: string;
    startDate?: string;
    endDate?: string;
  }>(req);

  const { employeeId, shiftTemplateId, startDate, endDate } = body;

  if (!employeeId?.trim()) return badRequest("employeeId is required.");
  if (!shiftTemplateId?.trim()) return badRequest("shiftTemplateId is required.");
  if (!startDate?.trim()) return badRequest("startDate is required.");

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate)) return badRequest("startDate must be in YYYY-MM-DD format.");
  if (endDate && !dateRegex.test(endDate)) return badRequest("endDate must be in YYYY-MM-DD format.");

  try {
    // Verify employee exists
    const employeeDoc = await adminDb.collection("users").doc(employeeId).get();
    if (!employeeDoc.exists) return notFound("Employee not found.");
    const employeeData = employeeDoc.data() as AppUser;

    // Verify shift template exists
    const shiftDoc = await adminDb.collection("shift_templates").doc(shiftTemplateId).get();
    if (!shiftDoc.exists) return notFound("Shift template not found.");
    const shiftData = shiftDoc.data() as ShiftTemplate;

    const scheduleId = adminDb.collection("employee_schedules").doc().id;
    const now = new Date().toISOString();

    const schedule: EmployeeSchedule = {
      id: scheduleId,
      employeeId,
      employeeName: employeeData.displayName,
      shiftTemplateId,
      shiftTemplateName: shiftData.name,
      startDate,
      endDate: endDate || undefined,
      overrides: [],
      createdBy: session.uid,
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.collection("employee_schedules").doc(scheduleId).set(schedule);

    return ok(schedule);
  } catch (err) {
    return serverError(err);
  }
}
