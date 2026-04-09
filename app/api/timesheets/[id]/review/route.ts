/**
 * app/api/timesheets/[id]/review/route.ts
 *
 * POST — Admin approves or rejects a submitted timesheet.
 * Body: { action: "approve" | "reject", note?: string }
 */

import { NextRequest } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { getTimesheet, updateTimesheet } from "@/lib/timesheets/queries";
import {
  safeParseBody,
  unauthorized,
  forbidden,
  badRequest,
  notFound,
  serverError,
  ok,
} from "@/lib/api/helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) return forbidden("Admin access required.");

  try {
    const { id } = await params;

    const body = await safeParseBody<{
      action?: string;
      note?:   string;
    }>(req);

    const { action, note } = body;

    if (!action || !["approve", "reject"].includes(action)) {
      return badRequest("action must be 'approve' or 'reject'.");
    }

    const ts = await getTimesheet(id);
    if (!ts) return notFound("Timesheet not found.");

    if (ts.locked) {
      return forbidden("Cannot modify a locked timesheet.");
    }

    if (ts.status !== "submitted") {
      return badRequest(
        `Cannot review a timesheet with status "${ts.status}". Must be "submitted".`
      );
    }

    const now = new Date().toISOString();
    const updates = {
      reviewedBy:   session.uid,
      reviewerName: session.name || "Admin",
      reviewNote:   note || null,
      reviewedAt:   now,
    };

    if (action === "approve") {
      await updateTimesheet(ts.id, { ...updates, status: "approved" });
      return ok({ ...ts, ...updates, status: "approved" });
    }

    // Reject
    await updateTimesheet(ts.id, { ...updates, status: "rejected" });
    return ok({ ...ts, ...updates, status: "rejected" });
  } catch (err) {
    return serverError(err);
  }
}
