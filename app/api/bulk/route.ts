/**
 * POST /api/bulk
 *
 * Admin/CEO only — perform bulk operations on multiple resources.
 *
 * Body:
 *   {
 *     action: "delete_employees" | "update_department" | "approve_leave" |
 *             "reject_leave" | "approve_timesheets" | "approve_expenses" |
 *             "generate_payslips"
 *     ids: string[]  // array of UIDs or document IDs (max 50)
 *     data?: {       // optional additional data (e.g. new department)
 *       department?: string
 *     }
 *   }
 *
 * Success 200:
 *   { success: true, processed: number, action: string }
 *
 * Error responses:
 *   401 — not authenticated
 *   403 — caller is not admin or CEO
 *   400 — invalid request (missing/empty ids, too many items, etc.)
 *   500 — server error
 */

import { type NextRequest } from "next/server";
import { verifySessionCookie, hasRole } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import {
  safeParseBody,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
  ok,
} from "@/lib/api/helpers";

const MAX_BULK_SIZE = 50;

interface BulkRequestBody {
  action: string;
  ids: unknown;
  data?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  // 1. Auth
  const cookie = req.cookies.get("session")?.value;
  if (!cookie) return unauthorized();
  const auth = await verifySessionCookie(cookie);
  if (!auth) return unauthorized();
  if (!hasRole(auth, "admin", "ceo")) return forbidden();

  // 2. Parse body
  const body = await safeParseBody<BulkRequestBody>(req);
  const { action, ids, data } = body;

  // 3. Validate action
  const validActions = [
    "delete_employees",
    "update_department",
    "approve_leave",
    "reject_leave",
    "approve_timesheets",
    "approve_expenses",
    "generate_payslips",
  ];
  if (!action || !validActions.includes(action as string)) {
    return badRequest(`Invalid action. Must be one of: ${validActions.join(", ")}`);
  }

  // 4. Validate ids
  if (!Array.isArray(ids)) {
    return badRequest("`ids` must be a non-empty array");
  }
  if (ids.length === 0) {
    return badRequest("`ids` array cannot be empty");
  }
  if (ids.length > MAX_BULK_SIZE) {
    return badRequest(`Maximum ${MAX_BULK_SIZE} items per operation`);
  }
  if (!ids.every((id) => typeof id === "string" && id.trim().length > 0)) {
    return badRequest("All `ids` must be non-empty strings");
  }

  const typedIds = ids as string[];

  try {
    let processed = 0;

    switch (action) {
      case "delete_employees":
        processed = await deleteEmployees(typedIds);
        break;

      case "update_department":
        if (!data?.department || typeof data.department !== "string") {
          return badRequest("`data.department` is required and must be a string");
        }
        processed = await updateEmployeeDepartment(
          typedIds,
          data.department as string
        );
        break;

      case "approve_leave":
        processed = await updateLeaveStatus(typedIds, "approved");
        break;

      case "reject_leave":
        processed = await updateLeaveStatus(typedIds, "rejected");
        break;

      case "approve_timesheets":
        processed = await updateTimesheetStatus(typedIds, "approved");
        break;

      case "approve_expenses":
        processed = await updateExpenseStatus(typedIds, "approved");
        break;

      case "generate_payslips":
        // Placeholder: just log for now
        console.log(`[BULK] generate_payslips called with ids: ${typedIds.join(", ")}`);
        processed = typedIds.length;
        break;

      default:
        return badRequest(`Unknown action: ${action}`);
    }

    return ok({ processed, action });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * Bulk delete employees by UID
 */
async function deleteEmployees(uids: string[]): Promise<number> {
  const batch = adminDb.batch();

  for (const uid of uids) {
    batch.delete(adminDb.collection("users").doc(uid));
  }

  await batch.commit();
  return uids.length;
}

/**
 * Bulk update employee department
 */
async function updateEmployeeDepartment(uids: string[], department: string): Promise<number> {
  const batch = adminDb.batch();

  for (const uid of uids) {
    batch.update(adminDb.collection("users").doc(uid), {
      department,
      updatedAt: new Date().toISOString(),
    });
  }

  await batch.commit();
  return uids.length;
}

/**
 * Bulk update leave request status
 */
async function updateLeaveStatus(
  leaveIds: string[],
  status: "approved" | "rejected"
): Promise<number> {
  const batch = adminDb.batch();
  const now = new Date().toISOString();

  for (const leaveId of leaveIds) {
    batch.update(adminDb.collection("leave_requests").doc(leaveId), {
      status,
      reviewedAt: now,
      updatedAt: now,
    });
  }

  await batch.commit();
  return leaveIds.length;
}

/**
 * Bulk update timesheet status
 */
async function updateTimesheetStatus(
  timesheetIds: string[],
  status: "approved" | "rejected"
): Promise<number> {
  const batch = adminDb.batch();
  const now = new Date().toISOString();

  for (const timesheetId of timesheetIds) {
    batch.update(adminDb.collection("timesheets").doc(timesheetId), {
      status,
      reviewedAt: now,
      updatedAt: now,
    });
  }

  await batch.commit();
  return timesheetIds.length;
}

/**
 * Bulk update expense status
 */
async function updateExpenseStatus(
  expenseIds: string[],
  status: "approved" | "rejected"
): Promise<number> {
  const batch = adminDb.batch();
  const now = new Date().toISOString();

  for (const expenseId of expenseIds) {
    batch.update(adminDb.collection("expenses").doc(expenseId), {
      status,
      approvedAt: now,
      updatedAt: now,
    });
  }

  await batch.commit();
  return expenseIds.length;
}
