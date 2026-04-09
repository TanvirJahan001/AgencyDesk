/**
 * app/api/schedules/[id]/route.ts
 *
 * PATCH  — Update an employee schedule. Admin/CEO only.
 * DELETE — Delete an employee schedule. Admin/CEO only.
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
import type { ShiftTemplate } from "@/types";

// ── PATCH ────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) return forbidden("Admin or CEO access required.");

  const { id } = await params;
  const body = await safeParseBody<{
    shiftTemplateId?: string;
    startDate?: string;
    endDate?: string;
    overrides?: any[];
  }>(req);

  try {
    const doc = await adminDb.collection("employee_schedules").doc(id).get();
    if (!doc.exists) return notFound("Schedule not found.");

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (body.shiftTemplateId !== undefined) {
      const shiftDoc = await adminDb
        .collection("shift_templates")
        .doc(body.shiftTemplateId)
        .get();
      if (!shiftDoc.exists) return notFound("Shift template not found.");
      const shiftData = shiftDoc.data() as ShiftTemplate;
      updates.shiftTemplateId = body.shiftTemplateId;
      updates.shiftTemplateName = shiftData.name;
    }

    if (body.startDate !== undefined) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(body.startDate)) {
        return badRequest("startDate must be in YYYY-MM-DD format.");
      }
      updates.startDate = body.startDate;
    }

    if (body.endDate !== undefined) {
      if (body.endDate && !new RegExp(/^\d{4}-\d{2}-\d{2}$/).test(body.endDate)) {
        return badRequest("endDate must be in YYYY-MM-DD format.");
      }
      updates.endDate = body.endDate || null;
    }

    if (body.overrides !== undefined) {
      if (!Array.isArray(body.overrides)) {
        return badRequest("overrides must be an array.");
      }
      updates.overrides = body.overrides;
    }

    if (Object.keys(updates).length === 1) {
      return badRequest("No valid fields provided to update.");
    }

    await adminDb.collection("employee_schedules").doc(id).update(updates);

    return ok(updates);
  } catch (err) {
    return serverError(err);
  }
}

// ── DELETE ───────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) return forbidden("Admin or CEO access required.");

  const { id } = await params;

  try {
    const doc = await adminDb.collection("employee_schedules").doc(id).get();
    if (!doc.exists) return notFound("Schedule not found.");

    await adminDb.collection("employee_schedules").doc(id).delete();

    return ok({ id, deleted: true });
  } catch (err) {
    return serverError(err);
  }
}
