/**
 * GET /api/attendance/current
 *
 * Fetch the authenticated employee's currently open session and the
 * open segment (if any). Returns null for both if not clocked in.
 *
 * Query params: none
 *
 * Success 200 (clocked in):
 *   { success: true, data: { session: AttendanceSessionV2, openSegment: SegmentDoc } }
 *
 * Success 200 (not clocked in):
 *   { success: true, data: { session: null, openSegment: null } }
 *
 * Error responses:
 *   401 — not authenticated
 *   500 — unexpected server error
 */

import { type NextRequest } from "next/server";
import { verifySessionCookie } from "@/lib/auth/withRoleGuard";
import { findOpenSession, getOpenSegment } from "@/lib/attendance/queries";
import { unauthorized, serverError, ok } from "@/lib/api/helpers";
import type { AttendanceSessionV2 } from "@/types";
import type { SegmentDoc } from "@/lib/attendance/queries";

interface CurrentSessionResponse {
  session:     AttendanceSessionV2 | null;
  openSegment: SegmentDoc | null;
}

export async function GET(req: NextRequest) {
  // 1. Authenticate
  const cookie = req.cookies.get("session")?.value;
  if (!cookie) return unauthorized();

  const auth = await verifySessionCookie(cookie);
  if (!auth) return unauthorized();

  // 2. Fetch open session + segment
  try {
    const session = await findOpenSession(auth.uid);

    if (!session) {
      return ok<CurrentSessionResponse>({ session: null, openSegment: null });
    }

    const openSegment = await getOpenSegment(session.id);

    return ok<CurrentSessionResponse>({ session, openSegment });
  } catch (err) {
    return serverError(err);
  }
}
