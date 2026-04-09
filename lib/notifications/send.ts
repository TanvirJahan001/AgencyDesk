/**
 * lib/notifications/send.ts
 *
 * Shared notification helpers used across all API routes.
 * Creates notifications in Firestore for the target user(s).
 */

import { adminDb } from "@/lib/firebase/admin";
import type { NotificationType } from "@/types";

interface SendNotificationParams {
  userId:     string;
  type:       NotificationType;
  title:      string;
  message:    string;
  linkTo?:    string;
  relatedId?: string;
}

/**
 * Send a notification to a single user.
 */
export async function sendNotification(params: SendNotificationParams) {
  const id = adminDb.collection("notifications").doc().id;
  await adminDb.collection("notifications").doc(id).set({
    id,
    userId:    params.userId,
    type:      params.type,
    title:     params.title,
    message:   params.message,
    read:      false,
    linkTo:    params.linkTo ?? null,
    relatedId: params.relatedId ?? null,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Send the same notification to multiple users.
 */
export async function sendNotificationToMany(
  userIds: string[],
  params: Omit<SendNotificationParams, "userId">
) {
  const batch = adminDb.batch();
  for (const userId of userIds) {
    const id = adminDb.collection("notifications").doc().id;
    const ref = adminDb.collection("notifications").doc(id);
    batch.set(ref, {
      id,
      userId,
      type:      params.type,
      title:     params.title,
      message:   params.message,
      read:      false,
      linkTo:    params.linkTo ?? null,
      relatedId: params.relatedId ?? null,
      createdAt: new Date().toISOString(),
    });
  }
  await batch.commit();
}

/**
 * Get all admin + CEO user IDs (for notifying privileged users).
 */
export async function getAdminAndCeoIds(): Promise<string[]> {
  const snap = await adminDb.collection("users")
    .where("role", "in", ["admin", "ceo"])
    .get();
  return snap.docs.map((d) => d.id);
}

/**
 * Get all team member IDs for a project.
 */
export async function getProjectTeamIds(projectId: string): Promise<string[]> {
  const doc = await adminDb.collection("projects").doc(projectId).get();
  if (!doc.exists) return [];
  const data = doc.data();
  return data?.teamMembers ?? [];
}
