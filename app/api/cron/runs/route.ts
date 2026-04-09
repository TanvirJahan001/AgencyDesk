/**
 * app/api/cron/runs/route.ts
 *
 * GET — List recent cron run logs (admin only).
 *
 * Query params:
 *   jobName = filter by job name
 *   limit   = number (default 20)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { getRecentCronRuns } from "@/lib/notifications/queries";

function errorJson(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !hasRole(session, "admin", "ceo")) {
    return errorJson("Admin access required.", 403);
  }

  const url = new URL(req.url);
  const jobName = url.searchParams.get("jobName") || undefined;
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);

  const runs = await getRecentCronRuns(jobName, limit);

  return NextResponse.json({ success: true, data: runs });
}
