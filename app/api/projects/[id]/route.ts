/**
 * GET /api/projects/[id]
 *   - Admin/CEO or team member can view
 *
 * PATCH /api/projects/[id]
 *   - Admin only. Update project fields.
 *
 * DELETE /api/projects/[id]
 *   - Admin only. Delete project.
 *   - Check no active tasks linked.
 */

import { type NextRequest } from "next/server";
import {
  safeParseBody,
  ok,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
  notFound,
} from "@/lib/api/helpers";
import { getAuthSession } from "@/lib/api/helpers";
import { hasRole } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import type { Project, AppUser } from "@/types";

async function getProject(id: string): Promise<Project | null> {
  const doc = await adminDb.collection("projects").doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as Project;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Auth
    const session = await getAuthSession(req);
    if (!session) return unauthorized();

    const project = await getProject(id);
    if (!project) return notFound(`Project ${id} not found`);

    // Check access
    const isAdmin = hasRole(session, "admin", "ceo");
    const isTeamMember = project.teamMembers.includes(session.uid);

    if (!isAdmin && !isTeamMember) {
      return forbidden();
    }

    return ok(project);
  } catch (err) {
    return serverError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Auth
    const session = await getAuthSession(req);
    if (!session) return unauthorized();
    if (!hasRole(session, "admin", "ceo")) return forbidden();

    // Get existing project
    const project = await getProject(id);
    if (!project) return notFound(`Project ${id} not found`);

    // Parse body
    const body = await safeParseBody<Partial<Project>>(req);

    // Update allowed fields
    const updates: Partial<Project> = {
      ...(body.name && { name: body.name.trim() }),
      ...(body.serviceType && { serviceType: body.serviceType.trim() }),
      ...(body.status && { status: body.status }),
      ...(body.description !== undefined && {
        description: body.description?.trim(),
      }),
      ...(body.budget !== undefined && { budget: body.budget }),
      ...(body.spent !== undefined && { spent: body.spent }),
      ...(body.currency && { currency: body.currency }),
      ...(body.startDate && { startDate: body.startDate }),
      ...(body.deadline && { deadline: body.deadline }),
      ...(body.completedDate !== undefined && {
        completedDate: body.completedDate,
      }),
      ...(body.teamMembers && { teamMembers: body.teamMembers }),
      ...(body.managerId && { managerId: body.managerId }),
      ...(body.tags !== undefined && { tags: body.tags }),
      updatedAt: new Date().toISOString(),
    };

    // If updating manager, look up the name
    if (body.managerId && body.managerId !== project.managerId) {
      const managerDoc = await adminDb
        .collection("users")
        .doc(body.managerId)
        .get();
      if (!managerDoc.exists) {
        return notFound(`Manager ${body.managerId} not found`);
      }
      const manager = managerDoc.data() as AppUser;
      updates.managerName = manager.displayName;
    }

    const updated = { ...project, ...updates };
    await adminDb.collection("projects").doc(id).set(updated);

    return ok(updated);
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Auth
    const session = await getAuthSession(req);
    if (!session) return unauthorized();
    if (!hasRole(session, "admin", "ceo")) return forbidden();

    // Check project exists
    const project = await getProject(id);
    if (!project) return notFound(`Project ${id} not found`);

    // Check no active tasks linked
    // Single .where() + JS filter to avoid composite index on projectId + status.
    const allProjectTasks = await adminDb
      .collection("tasks")
      .where("projectId", "==", id)
      .limit(500)
      .get();
    const activeTasks = allProjectTasks.docs.filter((d) =>
      ["todo", "in_progress", "review"].includes(d.data().status)
    );

    if (activeTasks.length > 0) {
      return badRequest(
        "Cannot delete project with active or in-progress tasks"
      );
    }

    // Delete project
    await adminDb.collection("projects").doc(id).delete();

    return ok();
  } catch (err) {
    return serverError(err);
  }
}
