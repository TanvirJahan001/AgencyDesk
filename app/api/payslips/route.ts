/**
 * app/api/payslips/route.ts
 *
 * GET: Fetch payslips
 *   - If admin/CEO: fetch all payslips, optional filter by employeeId and period
 *   - If employee: fetch only own payslips
 *   - Sort by period desc
 *
 * POST (Admin/CEO only): Generate payslips from payroll runs
 *   Body: { payrollRunIds: string[] } or { period: string }
 */

import { NextRequest } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import { safeParseBody, ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/helpers";
import type { Payslip, PayrollRun, AppUser } from "@/types";

// ─── GET: Fetch payslips ──────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized("Authentication required");

  const url = new URL(req.url);
  const employeeIdFilter = url.searchParams.get("employeeId") || undefined;
  const periodFilter = url.searchParams.get("period") || undefined;

  try {
    // Fetch with a single .where() at most — no composite index needed.
    // Additional filters and sorting are applied in JS after the fetch.
    let snap: FirebaseFirestore.QuerySnapshot;

    if (hasRole(session, "admin", "ceo")) {
      if (employeeIdFilter) {
        // Single-field where → no composite index required
        snap = await adminDb
          .collection("payslips")
          .where("employeeId", "==", employeeIdFilter)
          .limit(500)
          .get();
      } else {
        snap = await adminDb.collection("payslips").limit(500).get();
      }
    } else {
      // Employee: only own payslips
      snap = await adminDb
        .collection("payslips")
        .where("employeeId", "==", session.uid)
        .limit(200)
        .get();
    }

    let payslips = snap.docs.map((d) => d.data() as Payslip);

    // JS-side filter for period (avoids composite index on employeeId + period)
    if (periodFilter) {
      payslips = payslips.filter((p) => p.period === periodFilter);
    }

    // Sort by period descending
    payslips.sort((a, b) => (b.period || "").localeCompare(a.period || ""));

    return ok({ payslips });
  } catch (err) {
    return serverError(err);
  }
}

// ─── POST: Generate payslips from payroll runs ─────────────────

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized("Authentication required");

  // Only admin/CEO can generate payslips
  if (!hasRole(session, "admin", "ceo")) {
    return forbidden("Only admins and CEOs can generate payslips");
  }

  try {
    const body = await safeParseBody<{
      payrollRunIds?: string[];
      period?: string;
    }>(req);

    if (!body.payrollRunIds && !body.period) {
      return badRequest("Provide either payrollRunIds or period");
    }

    // Fetch the payroll runs
    let runs: PayrollRun[] = [];

    if (body.payrollRunIds && body.payrollRunIds.length > 0) {
      const runsSnap = await adminDb
        .collection("payroll_runs")
        .where("__name__", "in", body.payrollRunIds)
        .get();
      runs = runsSnap.docs.map((d) => d.data() as PayrollRun);
    } else if (body.period) {
      // Single .where() + JS-side status filter to avoid composite index.
      const runsSnap = await adminDb
        .collection("payroll_runs")
        .where("period", "==", body.period)
        .limit(500)
        .get();
      runs = runsSnap.docs
        .map((d) => d.data() as PayrollRun)
        .filter((r) => r.status === "processed");
    }

    if (runs.length === 0) {
      return badRequest("No payroll runs found for generation");
    }

    // Fetch employee details
    const userSnap = await adminDb.collection("users").get();
    const userMap = new Map<string, AppUser>();
    for (const d of userSnap.docs) {
      const u = d.data() as AppUser;
      userMap.set(u.uid, u);
    }

    // Generate payslips
    const createdPayslipIds: string[] = [];
    const now = new Date().toISOString();

    for (const run of runs) {
      const user = userMap.get(run.employeeId);
      const payslipId = adminDb.collection("payslips").doc().id;

      // Convert deductions number to deductions array if needed
      const deductionsArray = [];
      if (run.deductions && run.deductions > 0) {
        deductionsArray.push({
          name: "Deductions",
          amount: run.deductions,
        });
      }

      // Convert minutes to hours
      const regularHours = Math.round((run.regularMin / 60) * 100) / 100;
      const overtimeHours = Math.round((run.overtimeMin / 60) * 100) / 100;

      const payslip: Payslip = {
        id: payslipId,
        payrollRunId: run.id,
        employeeId: run.employeeId,
        employeeName: run.employeeName,
        period: run.period,
        periodStart: run.periodStart,
        periodEnd: run.periodEnd,
        department: user?.department,
        position: user?.position,
        regularHours,
        overtimeHours,
        regularPay: run.regularPay,
        overtimePay: run.overtimePay,
        grossPay: run.grossPay,
        deductions: deductionsArray,
        totalDeductions: run.deductions,
        netPay: run.netPay,
        generatedAt: now,
        generatedBy: session.uid,
        status: "generated",
        createdAt: now,
        updatedAt: now,
      };

      await adminDb.collection("payslips").doc(payslipId).set(payslip);
      createdPayslipIds.push(payslipId);
    }

    return ok({ createdPayslipIds, count: createdPayslipIds.length });
  } catch (err) {
    return serverError(err);
  }
}
