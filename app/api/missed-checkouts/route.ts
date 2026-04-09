/**
 * app/api/missed-checkouts/route.ts
 *
 * GET  — List missed checkouts (admin only)
 * POST — Manually trigger missed checkout detection (admin only)
 *
 * Query params (GET):
 *   resolution = "pending" | "auto_closed" | "admin_adjusted" | "employee_corrected"
 *   employeeId = filter by employee
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import {
  getAllMissedCheckouts,
  getMissedCheckoutsByEmployee,
  detectMissedCheckouts,
  createCronRunLog,
} from "@/lib/notifications/queries";

function errorJson(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !hasRole(session, "admin", "ceo")) {
    return errorJson("Admin access required.", 403);
  }

  const url = new URL(req.url);
  const resolution = url.searchParams.get("resolution") || undefined;
  const employeeId = url.searchParams.get("employeeId") || undefined;

  let records;
  if (employeeId) {
    records = await getMissedCheckoutsByEmployee(employeeId);
    if (resolution) {
      records = records.filter((r) => r.resolution === resolution);
    }
  } else {
    records = await getAllMissedCheckouts(resolution);
  }

  return NextResponse.json({ success: true, data: records });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !hasRole(session, "admin", "ceo")) {
    return errorJson("Admin access required.", 403);
  }

  const runId = `cron_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const startedAt = new Date().toISOString();

  try {
    const detected = await detectMissedCheckouts();

    await createCronRunLog({
      id: runId,
      jobName: "daily_missed_checkout",
      triggeredBy: session.uid,
      startedAt,
      completedAt: new Date().toISOString(),
      status: "success",
      summary: `Detected ${detected.length} missed checkout(s).`,
      details: { detectedIds: detected.map((d) => d.id) },
      createdAt: startedAt,
    });

    return NextResponse.json({
      success: true,
      data: {
        detected: detected.length,
        records: detected,
        runId,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Detection failed.";

    await createCronRunLog({
      id: runId,
      jobName: "daily_missed_checkout",
      triggeredBy: session.uid,
      startedAt,
      completedAt: new Date().toISOString(),
      status: "error",
      summary: msg,
      details: {},
      createdAt: startedAt,
    });

    return errorJson(msg, 500);
  }
}
