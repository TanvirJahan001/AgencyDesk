/**
 * app/api/departments/route.ts
 *
 * GET   — List all departments from Firestore, sorted by name.
 *         For each department, count employees where department === dept.name.
 *         All authenticated users can read.
 *
 * POST  — Create new department. Admin/CEO only.
 *         Required: name
 *         Optional: description, headId, headName, status
 *         Auto-generates ID and timestamps.
 */

import { NextRequest } from "next/server";
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
import { validateLength, firstError, MAX_LENGTHS } from "@/lib/api/validate";
import type { Department } from "@/types";

// ── GET ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const snap = await adminDb
      .collection("departments")
      .get();

    let departments = snap.docs.map((d) => d.data() as Department);

    // For each department, count assigned employees
    for (const dept of departments) {
      try {
        const empSnap = await adminDb
          .collection("users")
          .where("department", "==", dept.name)
          .get();
        dept.employeeCount = empSnap.size;
      } catch {
        dept.employeeCount = 0;
      }
    }

    // Sort by name
    departments.sort((a, b) => a.name.localeCompare(b.name));

    return ok(departments);
  } catch (err) {
    return serverError(err);
  }
}

// ── POST ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) return forbidden("Admin or CEO access required.");

  const body = await safeParseBody<{
    name?: string;
    description?: string;
    headId?: string;
    headName?: string;
    status?: string;
  }>(req);

  const { name, description, headId, headName, status } = body;

  if (!name?.trim()) return badRequest("name is required.");

  // Input validation
  const validationError = firstError(
    validateLength(name, "name", MAX_LENGTHS.name),
    validateLength(description, "description", MAX_LENGTHS.description),
  );
  if (validationError) return badRequest(validationError);

  try {
    // Check if department with same name already exists (case-insensitive)
    const existingSnap = await adminDb
      .collection("departments")
      .where("name", "==", name.trim())
      .get();

    if (!existingSnap.empty) {
      return badRequest(`Department "${name.trim()}" already exists.`);
    }

    // Validate status
    const deptStatus = (status === "inactive" ? "inactive" : "active") as "active" | "inactive";

    const departmentId = adminDb.collection("departments").doc().id;
    const now = new Date().toISOString();

    const department: Department = {
      id: departmentId,
      name: name.trim(),
      headId: headId || undefined,
      headName: headName || undefined,
      description: description?.trim() || undefined,
      employeeCount: 0,
      status: deptStatus,
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.collection("departments").doc(departmentId).set(department);

    return ok(department);
  } catch (err) {
    return serverError(err);
  }
}
