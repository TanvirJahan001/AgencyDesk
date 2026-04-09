/**
 * GET /api/tasks/[id]
 *   - Get single task. Admin/CEO or team member.
 *
 * PATCH /api/tasks/[id]
 *   - Update task (status, assignee, etc). Admin or assignee.
 *
 * DELETE /api/tasks/[id]
 *   - Admin only.
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
import { sendNotification, sendNotificationToMany, getAdminAndCeoIds } from "@/lib/notifications/send";
import type { Task, Project, AppUser } from "@/types";

async function getTask(id: string): Promise<Task | null> {
  const doc = await adminDb.collection("tasks").doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as Task;
}

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

    const task = await getTask(id);
    if (!task) return notFound(`Task ${id} not found`);

    // Get project
    const project = await getProject(task.projectId);
    if (!project) return notFound(`Project ${task.projectId} not found`);

    // Check access: admin/ceo or team member
    const isAdmin = hasRole(session, "admin", "ceo");
    const isTeamMember = project.teamMembers.includes(session.uid);

    if (!isAdmin && !isTeamMember) {
      return forbidden();
    }

    return ok(task);
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

    // Get existing task
    const task = await getTask(id);
    if (!task) return notFound(`Task ${id} not found`);

    // Check access: admin or assignee
    const isAdmin = hasRole(session, "admin", "ceo");
    const isAssignee = task.assigneeId === session.uid;

    if (!isAdmin && !isAssignee) {
      return forbidden();
    }

    // Parse body
    const body = await safeParseBody<Partial<Task>>(req);

    // Update allowed fields
    const updates: Partial<Task> = {
      ...(body.title && { title: body.title.trim() }),
      ...(body.description !== undefined && {
        description: body.description?.trim(),
      }),
      ...(body.status && { status: body.status }),
      ...(body.priority && { priority: body.priority }),
      ...(body.assigneeId !== undefined && { assigneeId: body.assigneeId }),
      ...(body.assigneeName !== undefined && {
        assigneeName: body.assigneeName,
      }),
      ...(body.dueDate !== undefined && { dueDate: body.dueDate }),
      ...(body.estimatedMin !== undefined && {
        estimatedMin: body.estimatedMin,
      }),
      ...(body.loggedMin !== undefined && { loggedMin: body.loggedMin }),
      ...(body.order !== undefined && { order: body.order }),
      ...(body.tags !== undefined && { tags: body.tags }),
      ...(body.completedAt !== undefined && { completedAt: body.completedAt }),
      updatedAt: new Date().toISOString(),
    };

    // If updating assignee, look up the name
    if (
      body.assigneeId !== undefined &&
      body.assigneeId &&
      body.assigneeId !== task.assigneeId
    ) {
      const userDoc = await adminDb.collection("users").doc(body.assigneeId).get();
      if (!userDoc.exists) {
        return notFound(`User ${body.assigneeId} not found`);
      }
      const user = userDoc.data() as AppUser;
      updates.assigneeName = user.displayName;
    }

    const updated = { ...task, ...updates };
    await adminDb.collection("tasks").doc(id).set(updated);

    // Notify if task status changed to "done"
    if (body.status === "done" && task.status !== "done") {
      try {
        const adminIds = await getAdminAndCeoIds();
        await sendNotificationToMany(adminIds, {
          type: "task_completed",
          title: "Task Completed",
          message: `${updates.assigneeName ?? "Someone"} completed '${task.title}' in project ${task.projectName}`,
          linkTo: "/admin/projects",
          relatedId: task.projectId,
        });
      } catch {
        // Silent fail - notification should not break the operation
      }
    }

    // Notify if assignee changed (new assignment)
    if (
      body.assigneeId !== undefined &&
      body.assigneeId &&
      body.assigneeId !== task.assigneeId
    ) {
      try {
        await sendNotification({
          userId: body.assigneeId,
          type: "task_assigned",
          title: "New Task Assigned",
          message: `You've been assigned '${task.title}' in project ${task.projectName}`,
          linkTo: `/employee/projects/${task.projectId}`,
          relatedId: id,
        });
      } catch {
        // Silent fail - notification should not break the operation
      }
    }

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

    // Check task exists
    const task = await getTask(id);
    if (!task) return notFound(`Task ${id} not found`);

    // Delete task
    await adminDb.collection("tasks").doc(id).delete();

    return ok();
  } catch (err) {
    return serverError(err);
  }
}
