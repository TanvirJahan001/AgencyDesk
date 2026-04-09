/**
 * app/api/missed-checkouts/[id]/resolve/route.ts
 *
 * POST — Admin resolves a missed checkout.
 *
 * Body:
 *   resolution:      "admin_adjusted" | "employee_corrected"
 *   adjustedEndTime?: ISO 8601 string
 *   note?:           string
 */

import { NextRequest } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { resolveMissedCheckout } from "@/lib/notifications/queries";
import {
  safeParseBody,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
  ok,
} from "@/lib/api/helpers";
import type { MissedCheckoutResolution } from "@/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) return forbidden("Admin access required.");

  const { id } = await params;

  const body = await safeParseBody<{
    resolution?:      string;
    adjustedEndTime?: string;
    note?:            string;
  }>(req);

  const { resolution, adjustedEndTime, note } = body;

  if (!resolution || !["admin_adjusted", "employee_corrected"].includes(resolution)) {
    return badRequest('resolution must be "admin_adjusted" or "employee_corrected".');
  }

  if (resolution === "admin_adjusted" && !adjustedEndTime) {
    return badRequest("adjustedEndTime is required for admin_adjusted resolution.");
  }

  try {
    await resolveMissedCheckout(
      id,
      session.uid,
      session.name || session.email,
      resolution as MissedCheckoutResolution,
      adjustedEndTime,
      note
    );

    return ok({ resolved: id });
  } catch (err) {
    return serverError(err);
  }
}
