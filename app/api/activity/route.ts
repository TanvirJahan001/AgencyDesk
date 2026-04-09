/**
 * app/api/activity/route.ts
 *
 * GET — Admin/CEO only. Returns recent activity from multiple collections,
 *       merged and sorted by timestamp. Returns array of unified timeline entries.
 *
 * Query params:
 *   limit (optional) — max total results (default 50)
 *
 * Response: Array of { id, type, title, description, timestamp, actorName, actorId }
 */

import { NextRequest } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import {
  unauthorized,
  forbidden,
  serverError,
  ok,
} from "@/lib/api/helpers";
import type { AuditLog, LeaveRequest, Expense, Announcement } from "@/types";

interface ActivityEntry {
  id: string;
  type: "audit_log" | "leave_request" | "expense" | "correction_request" | "announcement";
  title: string;
  description: string;
  timestamp: string;
  actorName: string;
  actorId: string;
  metadata?: Record<string, unknown>;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) return forbidden("Admin or CEO access required.");

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "50"), 200);
  const itemsPerCollection = Math.ceil(limit / 5); // Fetch 10 items from each, then merge & limit total

  try {
    const entries: ActivityEntry[] = [];

    // 1. Fetch audit logs
    // Plain fetch + JS sort to avoid needing single-field index on createdAt.
    try {
      const auditSnap = await adminDb
        .collection("audit_logs")
        .limit(itemsPerCollection * 2)
        .get();

      auditSnap.docs.forEach((doc) => {
        const data = doc.data() as AuditLog;
        entries.push({
          id: doc.id,
          type: "audit_log",
          title: data.type || "Audit Log",
          description: data.note || "No details",
          timestamp: data.timestamp || new Date().toISOString(),
          actorName: data.adminName || "System",
          actorId: data.adminId || "system",
          metadata: { action: data.type, entityType: data.employeeId },
        });
      });
    } catch {
      // Silently skip if collection doesn't exist or query fails
    }

    // 2. Fetch leave requests
    try {
      const leaveSnap = await adminDb
        .collection("leave_requests")
        .limit(itemsPerCollection * 2)
        .get();

      leaveSnap.docs.forEach((doc) => {
        const data = doc.data() as LeaveRequest;
        entries.push({
          id: doc.id,
          type: "leave_request",
          title: `Leave Request (${data.status || "pending"})`,
          description: `${data.employeeName || "Employee"} requested ${data.leaveType || "leave"}`,
          timestamp: data.createdAt || new Date().toISOString(),
          actorName: data.employeeName || "Unknown",
          actorId: data.employeeId || "unknown",
          metadata: { status: data.status, leaveType: data.leaveType },
        });
      });
    } catch {
      // Silently skip
    }

    // 3. Fetch expenses
    try {
      const expenseSnap = await adminDb
        .collection("expenses")
        .limit(itemsPerCollection * 2)
        .get();

      expenseSnap.docs.forEach((doc) => {
        const data = doc.data() as Expense;
        entries.push({
          id: doc.id,
          type: "expense",
          title: `Expense (${data.status || "pending"})`,
          description: `${data.employeeName || "Employee"} submitted expense of ${data.amount || "0"}`,
          timestamp: data.createdAt || new Date().toISOString(),
          actorName: data.employeeName || "Unknown",
          actorId: data.employeeId || "unknown",
          metadata: { status: data.status, amount: data.amount, category: data.category },
        });
      });
    } catch {
      // Silently skip
    }

    // 4. Fetch correction requests
    try {
      const correctionSnap = await adminDb
        .collection("correction_requests")
        .limit(itemsPerCollection * 2)
        .get();

      correctionSnap.docs.forEach((doc) => {
        const data = doc.data() as Record<string, unknown>;
        entries.push({
          id: doc.id,
          type: "correction_request",
          title: `Correction Request (${data.status || "pending"})`,
          description: `Correction requested for ${data.employeeName || "employee"}`,
          timestamp: (data.createdAt as string) || new Date().toISOString(),
          actorName: (data.employeeName as string) || "Unknown",
          actorId: (data.employeeId as string) || "unknown",
          metadata: { status: data.status, type: data.correctionType },
        });
      });
    } catch {
      // Silently skip
    }

    // 5. Fetch announcements
    try {
      const announcementSnap = await adminDb
        .collection("announcements")
        .limit(itemsPerCollection * 2)
        .get();

      announcementSnap.docs.forEach((doc) => {
        const data = doc.data() as Announcement;
        entries.push({
          id: doc.id,
          type: "announcement",
          title: data.title || "Announcement",
          description: data.content || "No description",
          timestamp: data.createdAt || new Date().toISOString(),
          actorName: data.authorName || "Unknown",
          actorId: data.authorId || "unknown",
          metadata: { priority: data.priority, pinned: data.pinned },
        });
      });
    } catch {
      // Silently skip
    }

    // Sort all entries by timestamp descending and limit to requested count
    entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const results = entries.slice(0, limit);

    return ok(results);
  } catch (err) {
    return serverError(err);
  }
}
