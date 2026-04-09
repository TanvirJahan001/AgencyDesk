/**
 * app/api/cron/weekly-ceo-report/route.ts
 *
 * POST — Generates a weekly CEO summary notification.
 *
 * Aggregates:
 *   - Total sessions this week
 *   - Total missed checkouts this week
 *   - Pending corrections
 *   - Active employees
 *
 * Auth:
 *   - Vercel cron: Authorization header matches CRON_SECRET env var
 *   - Manual admin: session cookie with admin role
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import {
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
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (cronSecret && authHeader) {
    const expected = `Bearer ${cronSecret}`;
    if (
      authHeader.length === expected.length &&
      require("crypto").timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
    ) {
      return { ok: true, triggeredBy: "cron" };
    }
  }

  const session = await getSession();
  if (session && hasRole(session, "admin", "ceo")) {
    return { ok: true, triggeredBy: session.uid };
  }

  return { ok: false, triggeredBy: "" };
}

/** Get Monday of this week in YYYY-MM-DD */
function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun ... 6=Sat
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  return monday.toISOString().slice(0, 10);
}

/** Get Sunday of this week in YYYY-MM-DD */
function getWeekEnd(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  const sunday = new Date(now);
  sunday.setDate(now.getDate() + diff);
  return sunday.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const auth = await isAuthorized(req);
  if (!auth.ok) {
    return errorJson("Unauthorized.", 401);
  }

  const runId = `cron_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const startedAt = new Date().toISOString();
  const weekStart = getWeekStart();
  const weekEnd = getWeekEnd();

  try {
    // 1. Total completed sessions this week
    // Single .where() max — date range + status filtering done in JS to avoid composite index.
    const sessionsSnap = await adminDb
      .collection("attendance_sessions")
      .where("status", "==", "completed")
      .limit(2000)
      .get();
    const weekSessions = sessionsSnap.docs.filter((doc) => {
      const d = doc.data().date || "";
      return d >= weekStart && d <= weekEnd;
    });
    const totalSessions = weekSessions.length;

    // 2. Unique employees who worked this week
    const uniqueEmployees = new Set<string>();
    for (const doc of weekSessions) {
      uniqueEmployees.add(doc.data().employeeId);
    }

    // 3. Missed checkouts this week
    // Plain fetch + JS-side date filter to avoid composite index on sessionDate range.
    const missedSnap = await adminDb
      .collection("missed_checkouts")
      .limit(1000)
      .get();
    const weekMissed = missedSnap.docs.filter((doc) => {
      const d = doc.data().sessionDate || "";
      return d >= weekStart && d <= weekEnd;
    });
    const totalMissed = weekMissed.length;
    const pendingMissed = weekMissed.filter(
      (d) => d.data().resolution === "pending" || d.data().resolution === "auto_closed"
    ).length;

    // 4. Pending corrections
    const correctionsSnap = await adminDb
      .collection("correction_requests")
      .where("status", "==", "pending")
      .get();
    const pendingCorrections = correctionsSnap.size;

    // 5. Total employee count
    const employeesSnap = await adminDb
      .collection("users")
      .where("role", "==", "employee")
      .get();
    const totalEmployees = employeesSnap.size;

    // Build summary message
    const summary = [
      `Weekly Summary (${weekStart} to ${weekEnd}):`,
      `• ${totalSessions} completed sessions by ${uniqueEmployees.size} of ${totalEmployees} employees`,
      `• ${totalMissed} missed checkout(s) (${pendingMissed} pending review)`,
      `• ${pendingCorrections} correction request(s) pending`,
    ].join("\n");

    // 6. Notify all admins
    const adminSnap = await adminDb
      .collection("users")
      .where("role", "==", "admin")
      .get();

    for (const doc of adminSnap.docs) {
      const admin = doc.data() as AppUser;
      const notif = buildNotification(
        admin.uid,
        "general",
        "Weekly CEO Report",
        summary,
        "/admin"
      );
      await createNotification(notif);
    }

    await createCronRunLog({
      id: runId,
      jobName: "weekly_ceo_report",
      triggeredBy: auth.triggeredBy,
      startedAt,
      completedAt: new Date().toISOString(),
      status: "success",
      summary: `Report sent to ${adminSnap.size} admin(s).`,
      details: {
        weekStart,
        weekEnd,
        totalSessions,
        uniqueEmployees: uniqueEmployees.size,
        totalMissed,
        pendingMissed,
        pendingCorrections,
        totalEmployees,
      },
      createdAt: startedAt,
    });

    return NextResponse.json({
      success: true,
      data: {
        weekStart,
        weekEnd,
        totalSessions,
        activeEmployees: uniqueEmployees.size,
        totalMissed,
        pendingMissed,
        pendingCorrections,
        totalEmployees,
        runId,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "CEO report failed.";

    await createCronRunLog({
      id: runId,
      jobName: "weekly_ceo_report",
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
