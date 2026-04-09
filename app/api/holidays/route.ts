/**
 * app/api/holidays/route.ts
 *
 * GET   — List holidays. All authenticated users.
 *         Query: ?year=2026
 * POST  — Create holiday. Admin only.
 *         Required: name, date, type
 */

import { NextRequest } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import {
  safeParseBody,
  unauthorized,
  badRequest,
  forbidden,
  serverError,
  ok,
} from "@/lib/api/helpers";
import type { Holiday } from "@/types";

// ── GET ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year") ? parseInt(searchParams.get("year")!, 10) : new Date().getFullYear();

    // Single .where() only — sort in JS to avoid composite index on year + date.
    const snap = await adminDb
      .collection("holidays")
      .where("year", "==", year)
      .limit(200)
      .get();

    const holidays = snap.docs.map((d) => d.data() as Holiday);
    // Sort by date ascending in JS
    holidays.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

    return ok(holidays);
  } catch (err) {
    return serverError(err);
  }
}

// ── POST ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) return forbidden("Admin/CEO access required.");

  const body = await safeParseBody<{
    name?: string;
    date?: string;
    type?: string;
  }>(req);

  const { name, date, type } = body;

  if (!name?.trim()) return badRequest("name is required.");
  if (!date?.trim()) return badRequest("date is required.");
  if (!type) return badRequest("type is required.");

  if (!["public", "company"].includes(type)) {
    return badRequest('type must be "public" or "company".');
  }

  // Validate date format
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    return badRequest("Invalid date format. Use YYYY-MM-DD.");
  }

  try {
    const year = dateObj.getFullYear();
    const holidayId = adminDb.collection("holidays").doc().id;

    const holiday: Holiday = {
      id: holidayId,
      name,
      date,
      year,
      type: type as Holiday["type"],
      createdBy: session.uid,
      createdAt: new Date().toISOString(),
    };

    await adminDb.collection("holidays").doc(holidayId).set(holiday);

    return ok(holiday);
  } catch (err) {
    return serverError(err);
  }
}
