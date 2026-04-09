/**
 * app/api/payroll/[id]/route.ts
 *
 * GET   — Fetch a single payroll run detail.
 * PATCH — Update status (process/pay) or deductions.
 *         Body: { action: "process" | "pay" } or { deductions: number }
 */

import { NextRequest } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { getPayrollRun, updatePayrollRun } from "@/lib/payroll/queries";
import { round2 } from "@/lib/payroll/utils";
import {
  safeParseBody,
  unauthorized,
  forbidden,
  badRequest,
  notFound,
  serverError,
  ok,
} from "@/lib/api/helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const { id } = await params;
    const run = await getPayrollRun(id);
    if (!run) return notFound("Payroll run not found.");

    // Employees can only view their own
    if (!hasRole(session, "admin", "ceo") && run.employeeId !== session.uid) {
      return forbidden("Access denied.");
    }

    return ok(run);
  } catch (err) {
    return serverError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) return forbidden("Admin access required.");

  try {
    const { id } = await params;
    const run = await getPayrollRun(id);
    if (!run) return notFound("Payroll run not found.");

    const body = await safeParseBody<{
      action?:     string;
      deductions?: number;
    }>(req);

    const { action, deductions } = body;

    // ── Update deductions ────────────────────────────────────
    if (typeof deductions === "number") {
      if (run.status === "paid") {
        return badRequest("Cannot modify a paid payroll run.");
      }
      const netPay = round2(run.grossPay - deductions);
      await updatePayrollRun(id, { deductions, netPay });
      return ok({ ...run, deductions, netPay });
    }

    // ── Status transitions ───────────────────────────────────
    if (action === "process") {
      if (run.status !== "draft") {
        return badRequest(`Cannot process a "${run.status}" payroll run.`);
      }
      const now = new Date().toISOString();
      await updatePayrollRun(id, { status: "processed", processedAt: now });
      return ok({ ...run, status: "processed", processedAt: now });
    }

    if (action === "pay") {
      if (run.status !== "processed") {
        return badRequest(`Cannot mark as paid. Current status: "${run.status}".`);
      }
      const now = new Date().toISOString();
      await updatePayrollRun(id, { status: "paid", paidAt: now });
      return ok({ ...run, status: "paid", paidAt: now });
    }

    return badRequest("Provide action ('process'|'pay') or deductions.");
  } catch (err) {
    return serverError(err);
  }
}
