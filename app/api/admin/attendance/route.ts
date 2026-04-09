/**
 * GET /api/admin/attendance
 *
 * Admin/CEO only — fetch attendance sessions across all employees
 * with optional filters.
 *
 * Query params:
 *   from     — YYYY-MM-DD (default: 7 days ago)
 *   to       — YYYY-MM-DD (default: today)
 *   userId   — optional; filter to one employee
 *   status   — optional; "working" | "on_break" | "completed" | "missed_checkout"
 *   limit    — max results (default 300, max 500)
 *
 * Success 200:
 *   { success: true, data: AttendanceSessionV2[] }
 *
 * Error responses:
 *   401 — not authenticated
 *   403 — caller is not admin or CEO
 *   400 — invalid date params
 *   500 — server error
 */

import { type NextRequest } from "next/server";
import { verifySessionCookie } from "@/lib/auth/withRoleGuard";
import { getAllSessionsByRange } from "@/lib/attendance/queries";
import { isValidDate, todayDate } from "@/lib/attendance/db";
import { unauthorized, forbidden, badRequest, serverError, ok } from "@/lib/api/helpers";
import type { AttendanceSessionV2 } from "@/types";

const PRIVILEGED = new Set(["admin", "ceo"]);

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  // 1. Auth
  const cookie = req.cookies.get("session")?.value;
  if (!cookie) return unauthorized();
  const auth = await verifySessionCookie(cookie);
  if (!auth) return unauthorized();
  if (!PRIVILEGED.has(auth.role ?? "")) return forbidden();

  // 2. Parse params
  const { searchParams } = req.nextUrl;
  const fromParam   = searchParams.get("from");
  const toParam     = searchParams.get("to");
  const userIdParam = searchParams.get("userId");
  const statusParam = searchParams.get("status");
  const limitParam  = searchParams.get("limit");

  const from   = fromParam ?? daysAgo(7);
  const to     = toParam   ?? todayDate();
  const limit  = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 500) : 300;

  if (!isValidDate(from)) return badRequest(`Invalid "from" date: "${from}"`);
  if (!isValidDate(to))   return badRequest(`Invalid "to" date: "${to}"`);
  if (from > to)          return badRequest(`"from" must not be after "to"`);

  // 3. Fetch
  try {
    const sessions = await getAllSessionsByRange(
      from,
      to,
      limit,
      statusParam ?? undefined,
      userIdParam ?? undefined
    );
    return ok<AttendanceSessionV2[]>(sessions);
  } catch (err) {
    return serverError(err);
  }
}
