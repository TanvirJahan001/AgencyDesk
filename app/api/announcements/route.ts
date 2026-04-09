/**
 * app/api/announcements/route.ts
 *
 * GET   — List announcements. All authenticated.
 *         Returns non-expired, ordered by pinned desc then createdAt desc. Limit 20.
 * POST  — Create announcement. Admin/CEO only.
 *         Required: title, content.
 *         Optional: priority, pinned, expiresAt.
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
import { sendNotificationToMany } from "@/lib/notifications/send";
import { validateLength, firstError, MAX_LENGTHS } from "@/lib/api/validate";
import type { Announcement, AppUser } from "@/types";

// Force dynamic — prevent Next.js from caching this route
export const dynamic = "force-dynamic";

// ── GET ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    // Plain fetch + JS sort to avoid needing single-field index on createdAt.
    const snap = await adminDb
      .collection("announcements")
      .limit(100)
      .get();

    let announcements = snap.docs.map((d) => d.data() as Announcement);

    // Filter out expired announcements
    const now = new Date().toISOString();
    announcements = announcements.filter((a) => !a.expiresAt || a.expiresAt > now);

    // Sort: pinned first, then createdAt desc within groups
    announcements.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });

    return ok(announcements);
  } catch (err) {
    // If Firestore query fails (e.g. index issue), fallback to simple fetch
    console.error("[announcements GET] orderBy query failed, trying fallback:", err);
    try {
      const snap = await adminDb.collection("announcements").limit(100).get();
      let announcements = snap.docs.map((d) => d.data() as Announcement);
      const now = new Date().toISOString();
      announcements = announcements.filter((a) => !a.expiresAt || a.expiresAt > now);
      announcements.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return (b.createdAt || "").localeCompare(a.createdAt || "");
      });
      return ok(announcements);
    } catch (fallbackErr) {
      return serverError(fallbackErr);
    }
  }
}

// ── POST ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) return forbidden("Admin or CEO access required.");

  const body = await safeParseBody<{
    title?: string;
    content?: string;
    priority?: string;
    pinned?: boolean;
    expiresAt?: string;
  }>(req);

  const { title, content, priority, pinned, expiresAt } = body;

  if (!title?.trim()) return badRequest("title is required.");
  if (!content?.trim()) return badRequest("content is required.");

  // Input validation
  const validationError = firstError(
    validateLength(title, "title", MAX_LENGTHS.title),
    validateLength(content, "content", MAX_LENGTHS.content),
  );
  if (validationError) return badRequest(validationError);

  try {
    // Validate expiresAt if provided
    if (expiresAt) {
      const expiresDate = new Date(expiresAt);
      if (isNaN(expiresDate.getTime())) {
        return badRequest("Invalid expiresAt format. Use ISO 8601 timestamp.");
      }
    }

    // Get author name
    const userDoc = await adminDb.collection("users").doc(session.uid).get();
    const authorName = userDoc.data()?.displayName || session.name || "Unknown";

    const announcementId = adminDb.collection("announcements").doc().id;
    const now = new Date().toISOString();

    const announcement: Announcement = {
      id: announcementId,
      title,
      content,
      priority: (priority as Announcement["priority"]) || "normal",
      authorId: session.uid,
      authorName,
      pinned: pinned || false,
      expiresAt: expiresAt || undefined,
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.collection("announcements").doc(announcementId).set(announcement);

    // Notify all employees of new announcement
    try {
      const employeeSnap = await adminDb
        .collection("users")
        .where("role", "==", "employee")
        .get();
      const employeeIds = employeeSnap.docs.map((doc) => doc.id);

      if (employeeIds.length > 0) {
        // Truncate content to first 100 chars for message
        const truncatedContent = content.length > 100 ? content.substring(0, 100) + "..." : content;
        await sendNotificationToMany(employeeIds, {
          type: "announcement",
          title: title,
          message: truncatedContent,
          linkTo: "/employee/announcements",
          relatedId: announcementId,
        });
      }
    } catch {
      // Silent fail - notification should not break the operation
    }

    return ok(announcement);
  } catch (err) {
    return serverError(err);
  }
}
