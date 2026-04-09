/**
 * app/api/expenses/[id]/route.ts
 *
 * GET    — Get single expense.
 * PATCH  — Update expense. Employee can edit own pending.
 *          Admin can approve/reject.
 * DELETE — Delete expense. Admin only or employee can delete own pending.
 */

import { NextRequest } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import {
  safeParseBody,
  unauthorized,
  forbidden,
  badRequest,
  notFound,
  serverError,
  ok,
} from "@/lib/api/helpers";
import { sendNotification } from "@/lib/notifications/send";
import type { Expense, Project } from "@/types";

// ── GET ──────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;

  try {
    const doc = await adminDb.collection("expenses").doc(id).get();
    if (!doc.exists) return notFound("Expense not found.");

    const expense = doc.data() as Expense;

    // Employees can only see their own expenses
    if (!hasRole(session, "admin", "ceo") && expense.submittedBy !== session.uid) {
      return forbidden("You can only view your own expenses.");
    }

    return ok(expense);
  } catch (err) {
    return serverError(err);
  }
}

// ── PATCH ────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const body = await safeParseBody<{
    status?: string;
    category?: string;
    description?: string;
    amount?: number;
    projectId?: string | null;
  }>(req);

  try {
    const doc = await adminDb.collection("expenses").doc(id).get();
    if (!doc.exists) return notFound("Expense not found.");

    const expense = doc.data() as Expense;

    // Employee editing own pending expense
    if (body.category || body.description || body.amount) {
      if (!hasRole(session, "admin", "ceo") && expense.submittedBy !== session.uid) {
        return forbidden("You can only edit your own expenses.");
      }
      if (expense.status !== "pending") {
        return badRequest("Can only edit pending expenses.");
      }

      const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

      if (body.category) updates.category = body.category;
      if (body.description) updates.description = body.description;
      if (body.amount) {
        if (body.amount <= 0) {
          return badRequest("amount must be a positive number.");
        }
        updates.amount = body.amount;
      }

      // Update project info if projectId changes
      if (body.projectId !== undefined) {
        if (body.projectId) {
          const projDoc = await adminDb.collection("projects").doc(body.projectId).get();
          if (projDoc.exists) {
            const proj = projDoc.data() as Project;
            updates.projectId = body.projectId;
            updates.projectName = proj.name;
            updates.clientId = proj.clientId;
          }
        } else {
          updates.projectId = null;
          updates.projectName = null;
          updates.clientId = null;
        }
      }

      await adminDb.collection("expenses").doc(id).update(updates);
      return ok(updates);
    }

    // Admin approving/rejecting
    if (body.status) {
      if (!hasRole(session, "admin", "ceo")) {
        return forbidden("Only admin/CEO can approve or reject expenses.");
      }

      if (!["approved", "rejected"].includes(body.status)) {
        return badRequest("status must be 'approved' or 'rejected'.");
      }
      if (expense.status !== "pending") {
        return badRequest("Can only approve/reject pending expenses.");
      }

      const userDoc = await adminDb.collection("users").doc(session.uid).get();
      const approverName = userDoc.data()?.displayName || session.name || "Unknown";

      const updates: Partial<Expense> = {
        status: body.status as Expense["status"],
        approvedBy: session.uid,
        approvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await adminDb.collection("expenses").doc(id).update(updates);

      // Notify submitter based on approval/rejection
      try {
        if (body.status === "approved") {
          await sendNotification({
            userId: expense.submittedBy,
            type: "expense_approved",
            title: "Expense Approved",
            message: `Your $${expense.amount} ${expense.category} expense has been approved`,
            linkTo: "/employee/expenses",
            relatedId: id,
          });
        } else if (body.status === "rejected") {
          await sendNotification({
            userId: expense.submittedBy,
            type: "expense_rejected",
            title: "Expense Rejected",
            message: `Your $${expense.amount} ${expense.category} expense has been rejected`,
            linkTo: "/employee/expenses",
            relatedId: id,
          });
        }
      } catch {
        // Silent fail - notification should not break the operation
      }

      return ok(updates);
    }

    return badRequest("No valid fields provided to update.");
  } catch (err) {
    return serverError(err);
  }
}

// ── DELETE ───────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;

  try {
    const doc = await adminDb.collection("expenses").doc(id).get();
    if (!doc.exists) return notFound("Expense not found.");

    const expense = doc.data() as Expense;

    // Admin can delete any. Employee can delete own pending only.
    if (!hasRole(session, "admin", "ceo")) {
      if (expense.submittedBy !== session.uid) {
        return forbidden("You can only delete your own expenses.");
      }
      if (expense.status !== "pending") {
        return badRequest("You can only delete your own pending expenses.");
      }
    }

    await adminDb.collection("expenses").doc(id).delete();

    return ok({ id, deleted: true });
  } catch (err) {
    return serverError(err);
  }
}
