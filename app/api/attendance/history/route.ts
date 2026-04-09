/**
 * GET /api/attendance/history
 *
 * Fetch attendance session history for a date range.
 *
 * Query params:
 *   from     — start date YYYY-MM-DD (default: 30 days ago)
 *   to       — end date YYYY-MM-DD   (default: today)
 *   userId   — optional; admins/CEOs may pass any userId;
 *               employees always get their own history only
 *   limit    — max sessions to return (default 100, max 200)
 *
 * Success 200:
 *   { success: true, data: AttendanceSessionV2[] }
 *
 * Error responses:
 *   401 — not authenticated
 *   400 — invalid date format
 *   500 — unexpected server error
 *
 * Access control:
 *   - Employees: always query by their own uid regardless of userId param
 *   - Admins / CEOs: may query any userId (or their own if omitted)
 */

import { type NextRequest } from "next/server";
import { verifySessionCookie } from "@/lib/auth/withRoleGuard";
import { getSessionsByRange } from "@/lib/attendance/queries";
import { isValidDate, todayDate } from "@/lib/attendance/db";
import { unauthorized, badRequest, serverError, ok } from "@/lib/api/helpers";
import type { AttendanceSessionV2 } from "@/types";

/** YYYY-MM-DD date N days before today */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const ADMIN_ROLES = new Set(["admin", "ceo"]);

export async function GET(req: NextRequest) {
  // 1. Authenticate
  const cookie = req.cookies.get("session")?.value;
  if (!cookie) return unauthorized();

  const auth = await verifySessionCookie(cookie);
  if (!auth) return unauthorized();

  // 2. Parse & validate query params
  const { searchParams } = req.nextUrl;

  const fromParam  = searchParams.get("from");
  const toParam    = searchParams.get("to");
  const userIdParam = searchParams.get("userId");
  const limitParam = searchParams.get("limit");

  const fromDate = fromParam  ?? daysAgo(30);
  const toDate   = toParam    ?? todayDate();

  if (!isValidDate(fromDate)) {
    return badRequest(`Invalid "from" date: "${fromDate}". Expected YYYY-MM-DD.`);
  }
  if (!isValidDate(toDate)) {
    return badRequest(`Invalid "to" date: "${toDate}". Expected YYYY-MM-DD.`);
  }
  if (fromDate > toDate) {
    return badRequest(`"from" date (${fromDate}) must not be after "to" date (${toDate}).`);
  }

  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 200) : 100;
  if (isNaN(limit)) {
    return badRequest(`Invalid "limit" value: "${limitParam}". Must be a number.`);
  }

  // 3. Resolve target userId (employees can only see their own data)
  const isPrivileged = ADMIN_ROLES.has(auth.role ?? "");
  const targetUserId = isPrivileged && userIdParam ? userIdParam : auth.uid;

  // 4. Fetch sessions
  try {
    const sessions = await getSessionsByRange(targetUserId, fromDate, toDate, limit);
    return ok<AttendanceSessionV2[]>(sessions);
  } catch (err) {
    return serverError(err);
  }
}
