/**
 * app/api/cron/invoice-maintenance/route.ts
 *
 * POST — Invoice maintenance cron job
 *   Secured with CRON_SECRET bearer token OR admin session
 *   - Detects overdue invoices (status "issued", createdAt > 30 days ago)
 *   - Logs warnings but doesn't auto-change status
 *   - Writes cron_runs log entry
 *   - Returns results
 */

import { type NextRequest, NextResponse } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import type { Invoice, CronRunLog } from "@/types";

function errorJson(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

async function isAuthorized(
  req: NextRequest
): Promise<{ ok: boolean; triggeredBy: string }> {
  // Check Vercel cron secret first
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
    return errorJson("Unauthorized", 401);
  }

  const runId = `cron_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const startedAt = new Date().toISOString();

  try {
    // 1. Query all invoices with status "issued"
    const invoicesSnap = await adminDb
      .collection("invoices")
      .where("status", "==", "issued")
      .get();

    const invoices = invoicesSnap.docs.map((d) => d.data() as Invoice);

    // 2. Check for overdue (createdAt > 30 days ago)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const overdue: Invoice[] = [];

    for (const invoice of invoices) {
      const createdAt = new Date(invoice.createdAt);
      if (createdAt < thirtyDaysAgo) {
        overdue.push(invoice);
      }
    }

    // 3. Log warnings (but don't change status)
    const warnings: string[] = [];
    for (const invoice of overdue) {
      const msg = `Overdue invoice: ${invoice.invoiceNumber} (${invoice.employeeName}, ${Math.floor(
        (now.getTime() - new Date(invoice.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      )} days)`;
      warnings.push(msg);
      console.warn(`[invoice-maintenance] ${msg}`);
    }

    // 4. Write cron_runs log entry
    const cronLog: CronRunLog = {
      id: runId,
      jobName: "invoice_maintenance",
      triggeredBy: auth.triggeredBy,
      startedAt,
      completedAt: new Date().toISOString(),
      status: "success",
      summary: `Scanned ${invoices.length} issued invoices, found ${overdue.length} overdue.`,
      details: {
        totalScanned: invoices.length,
        overdueCount: overdue.length,
        overdueInvoices: overdue.map((i) => ({
          invoiceNumber: i.invoiceNumber,
          employeeName: i.employeeName,
          createdAt: i.createdAt,
        })),
        warnings,
      },
      createdAt: startedAt,
    };

    await adminDb.collection("cron_runs").doc(runId).set(cronLog);

    // 5. Return results
    return NextResponse.json({
      success: true,
      data: {
        runId,
        totalScanned: invoices.length,
        overdueCount: overdue.length,
        warnings,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Cron job failed";

    const cronLog: CronRunLog = {
      id: runId,
      jobName: "invoice_maintenance",
      triggeredBy: auth.triggeredBy,
      startedAt,
      completedAt: new Date().toISOString(),
      status: "error",
      summary: msg,
      details: {},
      createdAt: startedAt,
    };

    await adminDb.collection("cron_runs").doc(runId).set(cronLog);

    return errorJson(msg, 500);
  }
}
