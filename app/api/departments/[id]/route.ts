/**
 * app/api/departments/[id]/route.ts
 *
 * PATCH — Update department. Admin/CEO only.
 *         Can update: name, description, headId, headName, status
 *
 * DELETE — Delete department. Admin only.
 *          Checks if any employees are assigned first.
 *          Returns error if employees found: "Cannot delete department with assigned employees."
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
import { validateLength, firstError, MAX_LENGTHS } from "@/lib/api/validate";
import type { Department } from "@/types";

// ── PATCH ────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const { id } = await paramsPromise;

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

  try {
    const deptDoc = await adminDb.collection("departments").doc(id).get();
    if (!deptDoc.exists) return notFound("Department not found.");

    const department = deptDoc.data() as Department;

    // Input validation
    const validationError = firstError(
      name ? validateLength(name, "name", MAX_LENGTHS.name) : null,
      description ? validateLength(description, "description", MAX_LENGTHS.description) : null,
    );
    if (validationError) return badRequest(validationError);

    // Check for name duplication if name is being changed
    if (name && name.trim() !== department.name) {
      const existingSnap = await adminDb
        .collection("departments")
        .where("name", "==", name.trim())
        .get();

      if (!existingSnap.empty) {
        return badRequest(`Department "${name.trim()}" already exists.`);
      }
    }

    // Update fields
    const updates: Partial<Department> = {
      updatedAt: new Date().toISOString(),
    };

    if (name) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || undefined;
    if (headId !== undefined) updates.headId = headId || undefined;
    if (headName !== undefined) updates.headName = headName || undefined;
    if (status !== undefined) updates.status = (status === "inactive" ? "inactive" : "active");

    await adminDb.collection("departments").doc(id).update(updates);

    // Return updated department
    const updated = await adminDb.collection("departments").doc(id).get();
    return ok(updated.data() as Department);
  } catch (err) {
    return serverError(err);
  }
}

// ── DELETE ───────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const { id } = await paramsPromise;

  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin")) return forbidden("Admin access required.");

  try {
    const deptDoc = await adminDb.collection("departments").doc(id).get();
    if (!deptDoc.exists) return notFound("Department not found.");

    const department = deptDoc.data() as Department;

    // Check if any employees are assigned to this department
    const empSnap = await adminDb
      .collection("users")
      .where("department", "==", department.name)
      .get();

    if (!empSnap.empty) {
      return badRequest("Cannot delete department with assigned employees.");
    }

    // Safe to delete
    await adminDb.collection("departments").doc(id).delete();

    return ok({ message: "Department deleted successfully." });
  } catch (err) {
    return serverError(err);
  }
}
