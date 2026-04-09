/**
 * GET /api/time-logs
 *   - Filter by ?projectId=x&taskId=x&employeeId=x&from=date&to=date
 *   - Admin/CEO see all time logs
 *   - Employees see only their own
 *
 * POST /api/time-logs
 *   - Any employee. Creates a time log.
 *   - Required: taskId, projectId, minutes, date
 *   - Updates task.loggedMin and project.spent
 */

import { type NextRequest } from "next/server";
import type { firestore } from "firebase-admin";
import {
  safeParseBody,
  ok,
  unauthorized,
  badRequest,
  serverError,
  notFound,
} from "@/lib/api/helpers";
import { getAuthSession } from "@/lib/api/helpers";
import { hasRole } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import type { TimeLog, Task, Project, AppUser } from "@/types";

export async function GET(req: NextRequest) {
  try {
    // Auth
    const session = await getAuthSession(req);
    if (!session) return unauthorized();

    // Parse query params
    const { searchParams } = req.nextUrl;
    const projectId = searchParams.get("projectId");
    const taskId = searchParams.get("taskId");
    const employeeId = searchParams.get("employeeId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // Build query
    let query: firestore.Query = adminDb.collection("time_logs");

    // Use at most ONE .where() to avoid composite index requirements.
    // Pick the most selective filter; apply the rest in JS after fetch.
    if (taskId) {
      query = query.where("taskId", "==", taskId);
    } else if (employeeId) {
      query = query.where("employeeId", "==", employeeId);
    } else if (projectId) {
      query = query.where("projectId", "==", projectId);
    }

    const snapshot = await query.limit(500).get();
    let logs = snapshot.docs.map((doc) => doc.data() as TimeLog);

    // JS-side filters for any params not used in the Firestore query
    if (taskId)      logs = logs.filter((l) => l.taskId     === taskId);
    if (projectId)   logs = logs.filter((l) => l.projectId  === projectId);
    if (employeeId)  logs = logs.filter((l) => l.employeeId === employeeId);
    if (from)        logs = logs.filter((l) => (l.date || "") >= from);
    if (to)          logs = logs.filter((l) => (l.date || "") <= to);

    // Sort by date descending
    logs.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    // Filter by access level
    if (!hasRole(session, "admin", "ceo")) {
      // Employees only see their own logs
      logs = logs.filter((log) => log.employeeId === session.uid);
    }

    return ok(logs);
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
      taskId: string;
      projectId: string;
      minutes: number;
      date: string;
      description?: string;
      employeeName?: string;
    }>(req);

    // Validate required fields
    const { taskId, projectId, minutes, date } = body;

    if (!taskId?.trim()) return badRequest("taskId is required");
    if (!projectId?.trim()) return badRequest("projectId is required");
    if (minutes === undefined || minutes === null)
      return badRequest("minutes is required");
    if (!date?.trim()) return badRequest("date is required");

    // Get task
    const taskDoc = await adminDb.collection("tasks").doc(taskId).get();
    if (!taskDoc.exists) return notFound(`Task ${taskId} not found`);
    const task = taskDoc.data() as Task;

    // Get project
    const projectDoc = await adminDb
      .collection("projects")
      .doc(projectId)
      .get();
    if (!projectDoc.exists) return notFound(`Project ${projectId} not found`);
    const project = projectDoc.data() as Project;

    // Get employee name
    const userDoc = await adminDb.collection("users").doc(session.uid).get();
    let employeeName = session.email || "Unknown";
    if (userDoc.exists) {
      const user = userDoc.data() as AppUser;
      employeeName = user.displayName;
    }

    // Generate ID
    const logId = adminDb.collection("time_logs").doc().id;

    // Create time log
    const timeLog: TimeLog = {
      id: logId,
      taskId,
      projectId,
      employeeId: session.uid,
      employeeName,
      description: body.description?.trim(),
      minutes,
      date,
      createdAt: new Date().toISOString(),
    };

    await adminDb.collection("time_logs").doc(logId).set(timeLog);

    // Update task.loggedMin
    const updatedTask: Task = {
      ...task,
      loggedMin: task.loggedMin + minutes,
      updatedAt: new Date().toISOString(),
    };
    await adminDb.collection("tasks").doc(taskId).set(updatedTask);

    // Update project.spent
    // Assume hourly rate logic: minutes * hourlyRate / 60
    // For now, just increment by minutes (can be enhanced with hourly rate calculation)
    const hourlyRate = 100; // Default rate, could be configured per employee
    const costAdded = (minutes / 60) * hourlyRate;

    const updatedProject: Project = {
      ...project,
      spent: project.spent + costAdded,
      updatedAt: new Date().toISOString(),
    };
    await adminDb.collection("projects").doc(projectId).set(updatedProject);

    return ok(timeLog);
  } catch (err) {
    return serverError(err);
  }
}
