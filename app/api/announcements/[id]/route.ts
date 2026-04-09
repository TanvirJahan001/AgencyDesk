/**
 * app/api/announcements/[id]/route.ts
 *
 * PATCH  — Update announcement. Admin/CEO only.
 * DELETE — Delete announcement. Admin/CEO only.
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
import type { Announcement } from "@/types";

// ── PATCH ────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) return forbidden("Admin or CEO access required.");

  const { id } = await params;
  const body = await safeParseBody<{
    title?: string;
    content?: string;
    priority?: string;
    pinned?: boolean;
    expiresAt?: string;
  }>(req);

  try {
    const doc = await adminDb.collection("announcements").doc(id).get();
    if (!doc.exists) return notFound("Announcement not found.");

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (body.title !== undefined) updates.title = body.title;
    if (body.content !== undefined) updates.content = body.content;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.pinned !== undefined) updates.pinned = body.pinned;
    if (body.expiresAt !== undefined) {
      if (body.expiresAt) {
        const expiresDate = new Date(body.expiresAt);
        if (isNaN(expiresDate.getTime())) {
          return badRequest("Invalid expiresAt format. Use ISO 8601 timestamp.");
        }
      }
      updates.expiresAt = body.expiresAt || null;
    }

    if (Object.keys(updates).length === 1) {
      return badRequest("No valid fields provided to update.");
    }

    await adminDb.collection("announcements").doc(id).update(updates);

    return ok(updates);
  } catch (err) {
    return serverError(err);
  }
}

// ── DELETE ───────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) return forbidden("Admin or CEO access required.");

  const { id } = await params;

  try {
    const doc = await adminDb.collection("announcements").doc(id).get();
    if (!doc.exists) return notFound("Announcement not found.");

    await adminDb.collection("announcements").doc(id).delete();

    return ok({ id, deleted: true });
  } catch (err) {
    return serverError(err);
  }
}
