/**
 * app/api/leave/route.ts
 *
 * GET    — List leave requests. Admin/CEO see all. Employees see own.
 *          Query: ?status=pending&employeeId=x
 * POST   — Create leave request. Any employee.
 *          Required: type, startDate, endDate, reason.
 */

import { NextRequest } from "next/server";
import type { firestore } from "firebase-admin";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import {
  safeParseBody,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
  ok,
} from "@/lib/api/helpers";
import { sendNotificationToMany, getAdminAndCeoIds } from "@/lib/notifications/send";
import type { LeaveRequest, LeaveBalance } from "@/types";

// Helper: Calculate business days between two dates
function calculateBusinessDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let count = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
  }
  return count;
}

// ── GET ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const employeeId = searchParams.get("employeeId");
    const mine = searchParams.get("mine") === "true";

    let query: firestore.Query = adminDb.collection("leave_requests");

    // If mine=true, always filter to current user's requests
    if (mine) {
      query = query.where("employeeId", "==", session.uid);
    } else if (!hasRole(session, "admin", "ceo")) {
      // Non-admin/CEO always see only their own
      query = query.where("employeeId", "==", session.uid);
    } else if (employeeId) {
      query = query.where("employeeId", "==", employeeId);
    }

    // No secondary .where() — avoid composite index on employeeId + status + createdAt.
    // Status filter applied in JS after fetch.
    const snap = await query.limit(500).get();
    let requests = snap.docs.map((d) => d.data() as LeaveRequest);

    if (status) requests = requests.filter((r) => r.status === status);

    // Sort by createdAt descending
    requests.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    return ok(requests);
  } catch (err) {
    return serverError(err);
  }
}

// ── POST ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await safeParseBody<{
    type?: string;
    startDate?: string;
    endDate?: string;
    reason?: string;
  }>(req);

  const { type, startDate, endDate, reason } = body;

  // Validate required fields
  if (!type?.trim()) return badRequest("type is required.");
  if (!startDate?.trim()) return badRequest("startDate is required.");
  if (!endDate?.trim()) return badRequest("endDate is required.");
  // reason is optional

  // Validate date format and range
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return badRequest("Invalid date format. Use YYYY-MM-DD.");
  }
  if (start > end) {
    return badRequest("startDate must be before endDate.");
  }

  try {
    // Calculate business days
    const totalDays = calculateBusinessDays(startDate, endDate);
    if (totalDays <= 0) {
      return badRequest("Leave period must span at least one business day.");
    }

    // Check leave balance if type requires balance check
    const now = new Date();
    const year = now.getFullYear();
    const needsBalance = ["annual", "sick", "personal"].includes(type);

    if (needsBalance) {
      // Use single .where() to avoid composite index on employeeId + year.
      // Filter by year in JS after fetch.
      const allBalancesSnap = await adminDb
        .collection("leave_balances")
        .where("employeeId", "==", session.uid)
        .limit(10)
        .get();

      let existingDoc = allBalancesSnap.docs.find((d) => d.data().year === year) ?? null;

      // Auto-create default balance if none exists for this year
      if (!existingDoc) {
        const balanceId = adminDb.collection("leave_balances").doc().id;
        const defaultBalance: LeaveBalance = {
          id: balanceId,
          employeeId: session.uid,
          year,
          annual:   { total: 20, used: 0, remaining: 20 },
          sick:     { total: 10, used: 0, remaining: 10 },
          personal: { total: 5,  used: 0, remaining: 5  },
          updatedAt: now.toISOString(),
        };
        await adminDb.collection("leave_balances").doc(balanceId).set(defaultBalance);
        existingDoc = { data: () => defaultBalance } as FirebaseFirestore.QueryDocumentSnapshot;
      }

      const balance = existingDoc.data() as LeaveBalance;
      const typeBalance = balance[type as keyof Omit<LeaveBalance, "id" | "employeeId" | "year" | "updatedAt">];

      if (typeBalance && typeBalance.remaining < totalDays) {
        return badRequest(
          `Insufficient ${type} leave. You have ${typeBalance.remaining} days remaining.`
        );
      }
    }

    // Get employee name from session
    const userDoc = await adminDb.collection("users").doc(session.uid).get();
    const employeeName = userDoc.data()?.displayName || session.name || "Unknown";

    // Create leave request
    const leaveId = adminDb.collection("leave_requests").doc().id;
    const leaveRequest: LeaveRequest = {
      id: leaveId,
      employeeId: session.uid,
      employeeName,
      type: type as LeaveRequest["type"],
      startDate,
      endDate,
      totalDays,
      reason: reason?.trim() || "",
      status: "pending",
      reviewedBy: null,
      reviewerName: null,
      reviewNote: null,
      reviewedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await adminDb.collection("leave_requests").doc(leaveId).set(leaveRequest);

    // Notify all admins/CEOs of new leave request
    try {
      const adminIds = await getAdminAndCeoIds();
      await sendNotificationToMany(adminIds, {
        type: "leave_requested",
        title: "New Leave Request",
        message: `${employeeName} requested ${type} leave from ${startDate} to ${endDate}`,
        linkTo: "/admin/leave",
        relatedId: leaveId,
      });
    } catch {
      // Silent fail - notification should not break the operation
    }

    return ok(leaveRequest);
  } catch (err) {
    return serverError(err);
  }
}
