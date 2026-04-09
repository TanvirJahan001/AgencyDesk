/**
 * app/api/leave/[id]/route.ts
 *
 * GET    — Get single leave request.
 * PATCH  — Update leave request.
 *          Employee can cancel own pending requests.
 *          Admin can approve/reject.
 *          Approving deducts from leave balance.
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
import type { LeaveRequest, LeaveBalance } from "@/types";

// ── GET ──────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;

  try {
    const doc = await adminDb.collection("leave_requests").doc(id).get();
    if (!doc.exists) return notFound("Leave request not found.");

    const request = doc.data() as LeaveRequest;

    // Employees can only see their own requests
    if (!hasRole(session, "admin", "ceo") && request.employeeId !== session.uid) {
      return forbidden("You can only view your own leave requests.");
    }

    return ok(request);
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
    reviewNote?: string;
  }>(req);

  try {
    const doc = await adminDb.collection("leave_requests").doc(id).get();
    if (!doc.exists) return notFound("Leave request not found.");

    const request = doc.data() as LeaveRequest;

    // Employee cancelling own pending request
    if (body.status === "cancelled") {
      if (!hasRole(session, "admin", "ceo") && request.employeeId !== session.uid) {
        return forbidden("You can only cancel your own leave requests.");
      }
      if (request.status !== "pending") {
        return badRequest("Can only cancel pending leave requests.");
      }

      const updated: Partial<LeaveRequest> = {
        status: "cancelled",
        updatedAt: new Date().toISOString(),
      };

      await adminDb.collection("leave_requests").doc(id).update(updated);
      return ok(updated);
    }

    // Admin approving/rejecting
    if (!hasRole(session, "admin", "ceo")) {
      return forbidden("Only admin/CEO can approve or reject leave requests.");
    }

    if (body.status === "approved") {
      if (request.status !== "pending") {
        return badRequest("Can only approve pending leave requests.");
      }

      // Deduct from leave balance
      const year = new Date(request.startDate).getFullYear();
      // Single .where() + JS-side year filter to avoid composite index.
      const allBalancesSnap = await adminDb
        .collection("leave_balances")
        .where("employeeId", "==", request.employeeId)
        .limit(50)
        .get();
      const balanceSnap = {
        empty: !allBalancesSnap.docs.some((d) => d.data().year === year),
        docs: allBalancesSnap.docs.filter((d) => d.data().year === year),
      };

      // Auto-create balance if none exists (default 20 annual, 10 sick, 5 personal)
      let balanceId: string;
      let balance: LeaveBalance;

      if (balanceSnap.empty) {
        const newId = adminDb.collection("leave_balances").doc().id;
        const newBalance: LeaveBalance = {
          id: newId,
          employeeId: request.employeeId,
          year,
          annual:   { total: 20, used: 0, remaining: 20 },
          sick:     { total: 10, used: 0, remaining: 10 },
          personal: { total: 5,  used: 0, remaining: 5  },
          updatedAt: new Date().toISOString(),
        };
        await adminDb.collection("leave_balances").doc(newId).set(newBalance);
        balanceId = newId;
        balance = newBalance;
      } else {
        balanceId = balanceSnap.docs[0].id;
        balance = balanceSnap.docs[0].data() as LeaveBalance;
      }

      // Update balance for the leave type
      const typeKey = request.type as keyof Pick<LeaveBalance, "annual" | "sick" | "personal">;
      if (typeKey in balance && balance[typeKey]) {
        const typeBalance = balance[typeKey] as { total: number; used: number; remaining: number };
        const newUsed = typeBalance.used + request.totalDays;
        const newRemaining = typeBalance.total - newUsed;

        await adminDb.collection("leave_balances").doc(balanceId).update({
          [request.type]: {
            total: typeBalance.total,
            used: newUsed,
            remaining: newRemaining,
          },
          updatedAt: new Date().toISOString(),
        });
      }

      const userDoc = await adminDb.collection("users").doc(session.uid).get();
      const reviewerName = userDoc.data()?.displayName || session.name || "Unknown";

      const updated: Partial<LeaveRequest> = {
        status: "approved",
        reviewedBy: session.uid,
        reviewerName,
        reviewNote: body.reviewNote || null,
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await adminDb.collection("leave_requests").doc(id).update(updated);

      // Notify employee of approval
      try {
        await sendNotification({
          userId: request.employeeId,
          type: "leave_approved",
          title: "Leave Approved",
          message: `Your ${request.type} leave from ${request.startDate} to ${request.endDate} has been approved.`,
          linkTo: "/employee/leave",
        });
      } catch {
        // Silent fail - notification should not break the operation
      }

      return ok(updated);
    }

    if (body.status === "rejected") {
      if (request.status !== "pending") {
        return badRequest("Can only reject pending leave requests.");
      }

      const userDoc = await adminDb.collection("users").doc(session.uid).get();
      const reviewerName = userDoc.data()?.displayName || session.name || "Unknown";

      const updated: Partial<LeaveRequest> = {
        status: "rejected",
        reviewedBy: session.uid,
        reviewerName,
        reviewNote: body.reviewNote || null,
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await adminDb.collection("leave_requests").doc(id).update(updated);

      // Notify employee of rejection
      try {
        await sendNotification({
          userId: request.employeeId,
          type: "leave_rejected",
          title: "Leave Rejected",
          message: `Your ${request.type} leave from ${request.startDate} to ${request.endDate} has been rejected.`,
          linkTo: "/employee/leave",
        });
      } catch {
        // Silent fail - notification should not break the operation
      }

      return ok(updated);
    }

    return badRequest("Invalid status. Must be 'approved', 'rejected', or 'cancelled'.");
  } catch (err) {
    return serverError(err);
  }
}
