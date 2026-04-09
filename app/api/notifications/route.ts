/**
 * app/api/notifications/route.ts
 *
 * GET    — Fetch current user's notifications (+ unread count)
 * PATCH  — Mark one or all notifications as read
 * DELETE — Delete one or all notifications
 *
 * Query params (GET):
 *   limit = number (default 20)
 *
 * Body (PATCH):
 *   { id: string }          → mark single notification read
 *   { markAllRead: true }   → mark all notifications read
 *
 * Body (DELETE):
 *   { id: string }          → delete single notification
 *   { deleteAll: true }     → delete all user's notifications
 */

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/withRoleGuard";
import {
  getNotificationsForUser,
  getUnreadCount,
  markNotificationRead,
  markAllRead,
  deleteNotification,
  deleteAllNotifications,
} from "@/lib/notifications/queries";
import {
  safeParseBody,
  unauthorized,
  badRequest,
  serverError,
  ok,
} from "@/lib/api/helpers";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized("Authentication required.");

  const url   = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);

  try {
    const [notifications, unreadCount] = await Promise.all([
      getNotificationsForUser(session.uid, limit),
      getUnreadCount(session.uid),
    ]);

    return ok({ notifications, unreadCount });
  } catch (err) {
    return serverError(err);
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized("Authentication required.");

  const body = await safeParseBody<{
    id?:          string;
    markAllRead?: boolean;
  }>(req);

  try {
    if (body.markAllRead) {
      await markAllRead(session.uid);
      return ok({ markedAll: true });
    }

    if (body.id) {
      await markNotificationRead(body.id);
      return ok({ markedId: body.id });
    }

    return badRequest("Provide { id } or { markAllRead: true }.");
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized("Authentication required.");

  const body = await safeParseBody<{
    id?:        string;
    deleteAll?: boolean;
  }>(req);

  try {
    if (body.deleteAll) {
      const deleted = await deleteAllNotifications(session.uid);
      return ok({ deleted });
    }

    if (body.id) {
      const success = await deleteNotification(body.id, session.uid);
      if (!success) {
        return badRequest("Notification not found or does not belong to you.");
      }
      return ok({ deletedId: body.id });
    }

    return badRequest("Provide { id } or { deleteAll: true }.");
  } catch (err) {
    return serverError(err);
  }
}
