/**
 * app/api/offboarding/route.ts
 *
 * GET:  Fetch all offboarding records (Admin/CEO only, with optional status filter)
 * POST: Create new offboarding record (Admin/CEO only)
 */

import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import {
  safeParseBody,
  ok,
  unauthorized,
  badRequest,
  serverError,
} from "@/lib/api/helpers";
import { adminDb } from "@/lib/firebase/admin";
import type { OffboardingRecord, ChecklistItem } from "@/types";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!hasRole(session, "admin", "ceo")) {
      return unauthorized();
    }

    // Optional status filter from query params
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get("status");

    let query = adminDb.collection("offboarding");

    // No .where() + .orderBy() combo — avoids composite index requirement.
    const snapshot = await query.limit(500).get();
    let records = snapshot.docs.map((doc) => doc.data() as OffboardingRecord);

    if (statusFilter) records = records.filter((r) => r.status === statusFilter);
    records.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    return ok(records);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!hasRole(session, "admin", "ceo")) {
      return unauthorized();
    }

    const body = await safeParseBody<{
      employeeId: string;
      lastDay: string;
      reason: "resignation" | "termination" | "retirement" | "contract_end" | "other";
    }>(request);

    // Validate required fields
    if (!body.employeeId || !body.lastDay || !body.reason) {
      return badRequest(
        "Missing required fields: employeeId, lastDay, reason"
      );
    }

    // Fetch employee from users collection to get name, dept, position
    const employeeDoc = await adminDb
      .collection("users")
      .doc(body.employeeId)
      .get();

    if (!employeeDoc.exists) {
      return badRequest("Employee not found");
    }

    const employeeData = employeeDoc.data();
    const employeeName = employeeData?.displayName || "Unknown";
    const department = employeeData?.department;
    const position = employeeData?.position;

    // Create checklist with generated IDs
    const DEFAULT_OFFBOARDING_CHECKLIST_ITEMS = [
      { title: "Revoke system access & credentials", completed: false },
      { title: "Collect company equipment", completed: false },
      { title: "Transfer project responsibilities", completed: false },
      { title: "Conduct exit interview", completed: false },
      { title: "Process final payroll", completed: false },
      { title: "Remove from communication channels", completed: false },
      { title: "Archive employee documents", completed: false },
      { title: "Update team assignments", completed: false },
      { title: "Send farewell communication", completed: false },
    ];

    const checklist: ChecklistItem[] = DEFAULT_OFFBOARDING_CHECKLIST_ITEMS.map(
      (item) => ({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...item,
      })
    );

    const now = new Date().toISOString();
    const recordId = `offboarding-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const record: OffboardingRecord = {
      id: recordId,
      employeeId: body.employeeId,
      employeeName,
      department,
      position,
      lastDay: body.lastDay,
      reason: body.reason,
      status: "pending",
      checklist,
      assignedTo: session.uid,
      assignedToName: session.name,
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.collection("offboarding").doc(recordId).set(record);

    return ok(record);
  } catch (err) {
    return serverError(err);
  }
}
