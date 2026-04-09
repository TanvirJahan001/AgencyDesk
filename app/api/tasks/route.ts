/**
 * GET /api/tasks
 *   - Filter by ?projectId=x&assigneeId=x&status=todo
 *   - Admin/CEO see all tasks
 *   - Employees see tasks assigned to them OR in their projects
 *
 * POST /api/tasks
 *   - Admin or project team member. Creates a new task.
 *   - Required: projectId, title, status, priority
 *   - Looks up projectName from Firestore
 */

import { type NextRequest } from "next/server";
import type { firestore } from "firebase-admin";
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
import { sendNotification } from "@/lib/notifications/send";
import { validateLength, firstError, MAX_LENGTHS } from "@/lib/api/validate";
import type { Task, Project } from "@/types";

export async function GET(req: NextRequest) {
  try {
    // Auth
    const session = await getAuthSession(req);
    if (!session) return unauthorized();

    // Parse query params
    const { searchParams } = req.nextUrl;
    const projectId = searchParams.get("projectId");
    const assigneeId = searchParams.get("assigneeId");
    const status = searchParams.get("status");

    // Build query — use at most ONE .where() to avoid composite index.
    // Pick the most selective filter; apply the rest in JS after fetch.
    let query: firestore.Query = adminDb.collection("tasks");

    if (projectId) {
      query = query.where("projectId", "==", projectId);
    } else if (assigneeId) {
      query = query.where("assigneeId", "==", assigneeId);
    } else if (status) {
      query = query.where("status", "==", status);
    }

    const snapshot = await query.limit(1000).get();
    let tasks = snapshot.docs.map((doc) => doc.data() as Task);

    // JS-side filters for params not used in the Firestore query
    if (projectId)  tasks = tasks.filter((t) => t.projectId === projectId);
    if (assigneeId) tasks = tasks.filter((t) => t.assigneeId === assigneeId);
    if (status)     tasks = tasks.filter((t) => t.status === status);

    // Filter by access level
    if (!hasRole(session, "admin", "ceo")) {
      // Employees see: tasks assigned to them OR tasks in projects they're on
      const projectsSnapshot = await adminDb
        .collection("projects")
        .where("teamMembers", "array-contains", session.uid)
        .get();

      const projectIds = new Set(
        projectsSnapshot.docs.map((doc) => (doc.data() as Project).id)
      );

      tasks = tasks.filter(
        (t) =>
          t.assigneeId === session.uid || projectIds.has(t.projectId)
      );
    }

    return ok(tasks);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    // Auth
    const session = await getAuthSession(req);
    if (!session) return unauthorized();

    // Parse body
    const body = await safeParseBody<{
      projectId: string;
      title: string;
      description?: string;
      status: string;
      priority: string;
      assigneeId?: string;
      assigneeName?: string;
      dueDate?: string;
      estimatedMin?: number;
      tags?: string[];
    }>(req);

    // Validate required fields
    const { projectId, title, status, priority } = body;

    if (!projectId?.trim()) return badRequest("projectId is required");
    if (!title?.trim()) return badRequest("title is required");
    if (!status?.trim()) return badRequest("status is required");
    if (!priority?.trim()) return badRequest("priority is required");

    // Input validation
    const validationError = firstError(
      validateLength(title, "title", MAX_LENGTHS.title),
      validateLength(body.description || "", "description", MAX_LENGTHS.description),
    );
    if (validationError) return badRequest(validationError);

    // Get project
    const projectDoc = await adminDb.collection("projects").doc(projectId).get();
    if (!projectDoc.exists) return notFound(`Project ${projectId} not found`);
    const project = projectDoc.data() as Project;

    // Check access: admin or team member
    const isAdmin = hasRole(session, "admin", "ceo");
    const isTeamMember = project.teamMembers.includes(session.uid);

    if (!isAdmin && !isTeamMember) {
      return forbidden();
    }

    // Generate ID
    const id = adminDb.collection("tasks").doc().id;

    // Create document
    const task: Task = {
      id,
      projectId,
      projectName: project.name,
      clientId: project.clientId,
      title: title.trim(),
      description: body.description?.trim(),
      status: status as any,
      priority: priority as any,
      assigneeId: body.assigneeId || null,
      assigneeName: body.assigneeName || null,
      dueDate: body.dueDate || null,
      estimatedMin: body.estimatedMin || 0,
      loggedMin: 0,
      order: 0,
      tags: body.tags,
      createdBy: session.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await adminDb.collection("tasks").doc(id).set(task);

    // Notify assignee if task has assignee
    if (body.assigneeId) {
      try {
        await sendNotification({
          userId: body.assigneeId,
          type: "task_assigned",
          title: "New Task Assigned",
          message: `You've been assigned '${title}' in project ${project.name}`,
          linkTo: `/employee/projects/${projectId}`,
          relatedId: id,
        });
      } catch {
        // Silent fail - notification should not break the operation
      }
    }

    return ok(task);
  } catch (err) {
    return serverError(err);
  }
}
