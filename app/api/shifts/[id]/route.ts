/**
 * app/api/shifts/[id]/route.ts
 *
 * PATCH  — Update a shift template. Admin/CEO only.
 * DELETE — Delete a shift template. Admin/CEO only.
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
import type { ShiftType, DayOfWeek } from "@/types";

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
    name?: string;
    type?: string;
    startTime?: string;
    endTime?: string;
    breakMinutes?: number;
    workDays?: number[];
    color?: string;
    isDefault?: boolean;
  }>(req);

  try {
    const doc = await adminDb.collection("shift_templates").doc(id).get();
    if (!doc.exists) return notFound("Shift template not found.");

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (body.name !== undefined) {
      if (!body.name.trim()) return badRequest("name cannot be empty.");
      updates.name = body.name;
    }

    if (body.type !== undefined) {
      if (!body.type.trim()) return badRequest("type cannot be empty.");
      updates.type = body.type as ShiftType;
    }

    if (body.startTime !== undefined) {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(body.startTime)) return badRequest("startTime must be in HH:MM format.");
      updates.startTime = body.startTime;
    }

    if (body.endTime !== undefined) {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(body.endTime)) return badRequest("endTime must be in HH:MM format.");
      updates.endTime = body.endTime;
    }

    if (body.breakMinutes !== undefined) {
      if (typeof body.breakMinutes !== "number" || body.breakMinutes < 0) {
        return badRequest("breakMinutes must be a non-negative number.");
      }
      updates.breakMinutes = body.breakMinutes;
    }

    if (body.workDays !== undefined) {
      if (!Array.isArray(body.workDays) || body.workDays.length === 0) {
        return badRequest("workDays must be a non-empty array.");
      }
      if (!body.workDays.every((d) => typeof d === "number" && d >= 0 && d <= 6)) {
        return badRequest("workDays must contain valid day numbers (0-6).");
      }
      updates.workDays = body.workDays as DayOfWeek[];
    }

    if (body.color !== undefined) updates.color = body.color;
    if (body.isDefault !== undefined) updates.isDefault = body.isDefault;

    if (Object.keys(updates).length === 1) {
      return badRequest("No valid fields provided to update.");
    }

    await adminDb.collection("shift_templates").doc(id).update(updates);

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
    const doc = await adminDb.collection("shift_templates").doc(id).get();
    if (!doc.exists) return notFound("Shift template not found.");

    await adminDb.collection("shift_templates").doc(id).delete();

    return ok({ id, deleted: true });
  } catch (err) {
    return serverError(err);
  }
}
