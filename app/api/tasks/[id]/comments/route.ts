/**
 * GET /api/tasks/[id]/comments
 *   - List comments for task. Any authenticated user.
 *
 * POST /api/tasks/[id]/comments
 *   - Add comment. Any authenticated user.
 */

import { type NextRequest } from "next/server";
import {
  safeParseBody,
  ok,
  unauthorized,
  badRequest,
  serverError,
  notFound,
} from "@/lib/api/helpers";
import { getAuthSession } from "@/lib/api/helpers";
import { adminDb } from "@/lib/firebase/admin";
import { validateLength, firstError, MAX_LENGTHS } from "@/lib/api/validate";
import type { TaskComment, Task } from "@/types";

async function getTask(id: string): Promise<Task | null> {
  const doc = await adminDb.collection("tasks").doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as Task;
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

    // Check task exists
    const task = await getTask(id);
    if (!task) return notFound(`Task ${id} not found`);

    // Get comments — single .where() only, sort in JS to avoid composite index.
    const snapshot = await adminDb
      .collection("task_comments")
      .where("taskId", "==", id)
      .limit(500)
      .get();

    const comments = snapshot.docs.map((doc) => doc.data() as TaskComment);
    // Sort by createdAt ascending in JS
    comments.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));

    return ok(comments);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Auth
    const session = await getAuthSession(req);
    if (!session) return unauthorized();

    // Check task exists
    const task = await getTask(id);
    if (!task) return notFound(`Task ${id} not found`);

    // Parse body
    const body = await safeParseBody<{
      content: string;
      authorName?: string;
    }>(req);

    // Validate
    if (!body.content?.trim()) {
      return badRequest("content is required");
    }

    // Input validation
    const validationError = validateLength(body.content, "content", MAX_LENGTHS.comment);
    if (validationError) return badRequest(validationError);

    // Generate ID
    const commentId = adminDb.collection("task_comments").doc().id;

    // Create comment
    const comment: TaskComment = {
      id: commentId,
      taskId: id,
      authorId: session.uid,
      authorName: body.authorName || session.email || "Unknown",
      content: body.content.trim(),
      createdAt: new Date().toISOString(),
    };

    await adminDb.collection("task_comments").doc(commentId).set(comment);

    return ok(comment);
  } catch (err) {
    return serverError(err);
  }
}
