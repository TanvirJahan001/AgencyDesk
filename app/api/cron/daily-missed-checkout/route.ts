/**
 * app/api/cron/daily-missed-checkout/route.ts
 *
 * POST — Runs missed checkout detection + sends daily reminder.
 *
 * Designed for two trigger modes:
 *   1. Vercel Cron (recommended): add to vercel.json with CRON_SECRET
 *   2. Manual: admin calls via button in dashboard
 *
 * Auth:
 *   - Vercel cron: Authorization header matches CRON_SECRET env var
 *   - Manual admin: session cookie with admin role
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import {
  detectMissedCheckouts,
  getPendingMissedCheckouts,
  createCronRunLog,
  buildNotification,
  createNotification,
} from "@/lib/notifications/queries";
import { adminDb } from "@/lib/firebase/admin";
import type { AppUser } from "@/types";

function errorJson(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

async function isAuthorized(req: NextRequest): Promise<{ ok: boolean; triggeredBy: string }> {
  // Check Vercel cron secret first
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (cronSecret && authHeader) {
    const expected = `Bearer ${cronSecret}`;
    // Timing-safe comparison to prevent timing attacks
    if (
      authHeader.length === expected.length &&
      require("crypto").timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
    ) {
      return { ok: true, triggeredBy: "cron" };
    }
  }

  // Fall back to admin session
  const session = await getSession();
  if (session && hasRole(session, "admin", "ceo")) {
    return { ok: true, triggeredBy: session.uid };
  }

  return { ok: false, triggeredBy: "" };
}

export async function POST(req: NextRequest) {
  const auth = await isAuthorized(req);
  if (!auth.ok) {
    return errorJson("Unauthorized.", 401);
  }

  const runId = `cron_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const startedAt = new Date().toISOString();

  try {
    // 1. Run detection
    const detected = await detectMissedCheckouts();

    // 2. Get all pending/auto_closed for daily reminder to admins
    const pending = await getPendingMissedCheckouts();

    // 3. Notify admins if there are any pending missed checkouts
    if (pending.length > 0) {
      const adminSnap = await adminDb
        .collection("users")
        .where("role", "==", "admin")
        .get();

      for (const doc of adminSnap.docs) {
        const admin = doc.data() as AppUser;
        const notif = buildNotification(
          admin.uid,
          "general",
          "Daily Missed Checkout Reminder",
          `There are ${pending.length} missed checkout(s) pending review.`,
          "/admin/attendance"
        );
        await createNotification(notif);
      }
    }

    await createCronRunLog({
      id: runId,
      jobName: "daily_missed_checkout",
      triggeredBy: auth.triggeredBy,
      startedAt,
      completedAt: new Date().toISOString(),
      status: "success",
      summary: `Detected ${detected.length} new, ${pending.length} total pending.`,
      details: {
        newlyDetected: detected.length,
        totalPending: pending.length,
        detectedIds: detected.map((d) => d.id),
      },
      createdAt: startedAt,
    });

    return NextResponse.json({
      success: true,
      data: {
        newlyDetected: detected.length,
        totalPending: pending.length,
        runId,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Cron job failed.";

    await createCronRunLog({
      id: runId,
      jobName: "daily_missed_checkout",
      triggeredBy: auth.triggeredBy,
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
