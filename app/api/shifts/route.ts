/**
 * app/api/shifts/route.ts
 *
 * GET   — List all shift templates. All authenticated.
 * POST  — Create a new shift template. Admin/CEO only.
 *         Required: name, type, startTime, endTime, breakMinutes, workDays.
 *         Optional: color, isDefault.
 */

import { NextRequest } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import {
  safeParseBody,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
  ok,
} from "@/lib/api/helpers";
import type { ShiftTemplate, ShiftType, DayOfWeek } from "@/types";

// ── GET ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const snap = await adminDb.collection("shift_templates").get();
    const shifts = snap.docs.map((d) => d.data() as ShiftTemplate);
    return ok(shifts);
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
    name?: string;
    type?: string;
    startTime?: string;
    endTime?: string;
    breakMinutes?: number;
    workDays?: number[];
    color?: string;
    isDefault?: boolean;
  }>(req);

  const { name, type, startTime, endTime, breakMinutes, workDays, color, isDefault } = body;

  if (!name?.trim()) return badRequest("name is required.");
  if (!type?.trim()) return badRequest("type is required.");
  if (!startTime?.trim()) return badRequest("startTime is required.");
  if (!endTime?.trim()) return badRequest("endTime is required.");
  if (breakMinutes === undefined) return badRequest("breakMinutes is required.");
  if (!workDays || !Array.isArray(workDays) || workDays.length === 0) {
    return badRequest("workDays must be a non-empty array.");
  }

  // Validate time format (HH:MM)
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(startTime)) return badRequest("startTime must be in HH:MM format.");
  if (!timeRegex.test(endTime)) return badRequest("endTime must be in HH:MM format.");

  // Validate break minutes
  if (typeof breakMinutes !== "number" || breakMinutes < 0) {
    return badRequest("breakMinutes must be a non-negative number.");
  }

  // Validate work days (0-6)
  if (!workDays.every((d) => typeof d === "number" && d >= 0 && d <= 6)) {
    return badRequest("workDays must contain valid day numbers (0-6).");
  }

  try {
    const shiftId = adminDb.collection("shift_templates").doc().id;
    const now = new Date().toISOString();

    const shift: ShiftTemplate = {
      id: shiftId,
      name,
      type: type as ShiftType,
      startTime,
      endTime,
      breakMinutes,
      workDays: workDays as DayOfWeek[],
      color: color || "#3b82f6", // Default blue
      isDefault: isDefault || false,
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.collection("shift_templates").doc(shiftId).set(shift);

    return ok(shift);
  } catch (err) {
    return serverError(err);
  }
}
