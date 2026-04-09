/**
 * app/api/onboarding/route.ts
 *
 * GET:  Fetch all onboarding records (Admin/CEO only, with optional status filter)
 * POST: Create new onboarding record (Admin/CEO only)
 */

import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import {
  safeParseBody,
  ok,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api/helpers";
import { adminDb } from "@/lib/firebase/admin";
import type {
  OnboardingRecord,
  DEFAULT_ONBOARDING_CHECKLIST,
  ChecklistItem,
} from "@/types";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!hasRole(session, "admin", "ceo")) {
      return unauthorized();
    }

    // Optional status filter from query params
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get("status");

    let query = adminDb.collection("onboarding");

    // No .where() + .orderBy() combo — avoids composite index requirement.
    const snapshot = await query.limit(500).get();
    let records = snapshot.docs.map((doc) => doc.data() as OnboardingRecord);

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
      startDate: string;
    }>(request);

    // Validate required fields
    if (!body.employeeId || !body.startDate) {
      return badRequest("Missing required fields: employeeId, startDate");
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
    const DEFAULT_ONBOARDING_CHECKLIST_ITEMS = [
      { title: "Create email account", completed: false },
      { title: "Set up workstation / laptop", completed: false },
      { title: "Provide access credentials", completed: false },
      { title: "Add to team communication channels", completed: false },
      { title: "Collect signed employment contract", completed: false },
      { title: "Collect ID documents & tax forms", completed: false },
      { title: "Schedule orientation meeting", completed: false },
      { title: "Assign mentor / buddy", completed: false },
      { title: "Complete first-day walkthrough", completed: false },
      { title: "Verify payroll setup", completed: false },
    ];

    const checklist: ChecklistItem[] = DEFAULT_ONBOARDING_CHECKLIST_ITEMS.map(
      (item) => ({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...item,
      })
    );

    const now = new Date().toISOString();
    const recordId = `onboarding-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const record: OnboardingRecord = {
      id: recordId,
      employeeId: body.employeeId,
      employeeName,
      department,
      position,
      startDate: body.startDate,
      status: "pending",
      checklist,
      assignedTo: session.uid,
      assignedToName: session.name,
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.collection("onboarding").doc(recordId).set(record);

    return ok(record);
  } catch (err) {
    return serverError(err);
  }
}
