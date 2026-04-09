/**
 * GET /api/audit-logs
 *
 * Admin/CEO only — fetch audit logs with optional filters.
 *
 * Query params:
 *   type       — optional; filter by log type
 *   employeeId — optional; filter by employee
 *   from       — optional; ISO 8601 date string (inclusive)
 *   to         — optional; ISO 8601 date string (inclusive)
 *   limit      — max results (default 100, max 500)
 *
 * Success 200:
 *   { success: true, data: AuditLog[] }
 *
 * Error responses:
 *   401 — not authenticated
 *   403 — caller is not admin or CEO
 *   400 — invalid params
 *   500 — server error
 */

import { type NextRequest } from "next/server";
import { verifySessionCookie } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import { unauthorized, forbidden, badRequest, serverError, ok } from "@/lib/api/helpers";
import type { AuditLog } from "@/types";

const PRIVILEGED = new Set(["admin", "ceo"]);

export async function GET(req: NextRequest) {
  // 1. Auth
  const cookie = req.cookies.get("session")?.value;
  if (!cookie) return unauthorized();
  const auth = await verifySessionCookie(cookie);
  if (!auth) return unauthorized();
  if (!PRIVILEGED.has(auth.role ?? "")) return forbidden();

  // 2. Parse params
  const { searchParams } = req.nextUrl;
  const typeParam = searchParams.get("type");
  const employeeIdParam = searchParams.get("employeeId");
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const limitParam = searchParams.get("limit");

  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 500) : 100;

  // Validate date params if provided
  if (fromParam) {
    try {
      new Date(fromParam).toISOString();
    } catch {
      return badRequest(`Invalid "from" date: "${fromParam}"`);
    }
  }
  if (toParam) {
    try {
      new Date(toParam).toISOString();
    } catch {
      return badRequest(`Invalid "to" date: "${toParam}"`);
    }
  }

  // 3. Build query — plain fetch, all filtering done in JS to avoid composite indexes
  try {
    const docs = await adminDb
      .collection("audit_logs")
      .limit(limit * 4)  // fetch extra to allow for JS-side filtering
      .get();

    let logs = docs.docs.map((doc) => doc.data() as AuditLog);

    // JS-side filters (avoids composite index on timestamp + type/employeeId)
    if (typeParam)       logs = logs.filter((l) => l.type       === typeParam);
    if (employeeIdParam) logs = logs.filter((l) => l.employeeId === employeeIdParam);
    if (fromParam)       logs = logs.filter((l) => (l.timestamp || "") >= fromParam);
    if (toParam)         logs = logs.filter((l) => (l.timestamp || "") <= toParam);

    // Sort by timestamp descending and limit
    logs.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
    logs = logs.slice(0, limit);

    return ok<AuditLog[]>(logs);
  } catch (err) {
    return serverError(err);
  }
}
