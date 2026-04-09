/**
 * POST /api/attendance/pause
 *
 * Pause the current work session and start a break.
 * No request body required.
 *
 * Success 200:
 *   { success: true, data: AttendanceSessionV2 }
 *
 * Error responses:
 *   401 — not authenticated
 *   400 — no active session, or session is not in "working" status
 *   500 — unexpected server error
 */

import { type NextRequest } from "next/server";
import { verifySessionCookie } from "@/lib/auth/withRoleGuard";
import { pauseWork } from "@/lib/attendance/actions";
import { unauthorized, badRequest, serverError, ok } from "@/lib/api/helpers";
import type { AttendanceSessionV2 } from "@/types";

export async function POST(req: NextRequest) {
  // 1. Authenticate
  const cookie = req.cookies.get("session")?.value;
  if (!cookie) return unauthorized();

  const auth = await verifySessionCookie(cookie);
  if (!auth) return unauthorized();

  // 2. Execute state transition (no request body needed)
  try {
    const session = await pauseWork(auth.uid);
    return ok<AttendanceSessionV2>(session);
  } catch (err) {
    if (err instanceof Error) return badRequest(err.message);
    return serverError(err);
  }
}
