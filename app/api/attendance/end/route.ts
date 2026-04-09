/**
 * POST /api/attendance/end
 *
 * End the current work session.
 * No request body required.
 *
 * Recalculates all totals (work minutes, break minutes, overtime) from
 * the full segment history — never trusts running counters alone.
 *
 * Success 200:
 *   { success: true, data: AttendanceSessionV2 }
 *
 * Error responses:
 *   401 — not authenticated
 *   400 — no active session found
 *   500 — unexpected server error
 */

import { type NextRequest } from "next/server";
import { verifySessionCookie } from "@/lib/auth/withRoleGuard";
import { endWork } from "@/lib/attendance/actions";
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
    const session = await endWork(auth.uid);
    return ok<AttendanceSessionV2>(session);
  } catch (err) {
    if (err instanceof Error) return badRequest(err.message);
    return serverError(err);
  }
}
