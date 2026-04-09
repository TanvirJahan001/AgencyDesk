/**
 * lib/notifications/queries.ts — Server-side notification + missed checkout CRUD
 *
 * Admin SDK only. Never import from client components.
 */

import { adminDb } from "@/lib/firebase/admin";
import type {
  AppNotification,
  MissedCheckout,
  MissedCheckoutResolution,
  CronRunLog,
  AttendanceSessionV2,
  NotificationType,
} from "@/types";

const notificationsCol = () => adminDb.collection("notifications");
const missedCol        = () => adminDb.collection("missed_checkouts");
const cronCol          = () => adminDb.collection("cron_runs");
const sessionsCol      = () => adminDb.collection("attendance_sessions");
const segmentsCol      = () => adminDb.collection("attendance_segments");

// ── Notifications ────────────────────────────────────────────

export async function createNotification(data: AppNotification): Promise<void> {
  await notificationsCol().doc(data.id).set(data);
}

export async function getNotificationsForUser(
  userId: string,
  limit = 20
): Promise<AppNotification[]> {
  const snap = await notificationsCol()
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data() as AppNotification);
}

export async function getUnreadCount(userId: string): Promise<number> {
  const snap = await notificationsCol()
    .where("userId", "==", userId)
    .where("read", "==", false)
    .get();
  return snap.size;
}

export async function markNotificationRead(id: string): Promise<void> {
  await notificationsCol().doc(id).update({ read: true });
}

export async function markAllRead(userId: string): Promise<void> {
  const snap = await notificationsCol()
    .where("userId", "==", userId)
    .where("read", "==", false)
    .get();
  const batch = adminDb.batch();
  for (const doc of snap.docs) {
    batch.update(doc.ref, { read: true });
  }
  await batch.commit();
}

export async function deleteNotification(id: string, userId: string): Promise<boolean> {
  const doc = await notificationsCol().doc(id).get();
  if (!doc.exists || (doc.data() as AppNotification).userId !== userId) return false;
  await notificationsCol().doc(id).delete();
  return true;
}

export async function deleteAllNotifications(userId: string): Promise<number> {
  const snap = await notificationsCol()
    .where("userId", "==", userId)
    .get();
  const batch = adminDb.batch();
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
  return snap.size;
}

/** Helper: create & return a notification with auto-generated ID */
export function buildNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  linkTo?: string,
  relatedId?: string
): AppNotification {
  const now = new Date().toISOString();
  return {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId,
    type,
    title,
    message,
    read: false,
    linkTo: linkTo || null,
    relatedId: relatedId || null,
    createdAt: now,
  };
}

// ── Missed Checkouts ─────────────────────────────────────────

export async function createMissedCheckout(data: MissedCheckout): Promise<void> {
  await missedCol().doc(data.id).set(data);
}

export async function getMissedCheckout(id: string): Promise<MissedCheckout | null> {
  const doc = await missedCol().doc(id).get();
  return doc.exists ? (doc.data() as MissedCheckout) : null;
}

export async function updateMissedCheckout(
  id: string,
  data: Partial<MissedCheckout>
): Promise<void> {
  await missedCol().doc(id).update({
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export async function getPendingMissedCheckouts(): Promise<MissedCheckout[]> {
  const snap = await missedCol()
    .where("resolution", "in", ["pending", "auto_closed"])
    .orderBy("detectedAt", "desc")
    .get();
  return snap.docs.map((d) => d.data() as MissedCheckout);
}

export async function getMissedCheckoutsByEmployee(
  employeeId: string
): Promise<MissedCheckout[]> {
  const snap = await missedCol()
    .where("employeeId", "==", employeeId)
    .orderBy("detectedAt", "desc")
    .limit(20)
    .get();
  return snap.docs.map((d) => d.data() as MissedCheckout);
}

export async function getAllMissedCheckouts(
  resolution?: string
): Promise<MissedCheckout[]> {
  let query: FirebaseFirestore.Query = missedCol()
    .orderBy("detectedAt", "desc");

  if (resolution) {
    query = missedCol()
      .where("resolution", "==", resolution)
      .orderBy("detectedAt", "desc");
  }

  const snap = await query.limit(100).get();
  return snap.docs.map((d) => d.data() as MissedCheckout);
}

/** Check if a missed checkout record already exists for a session */
export async function missedCheckoutExistsForSession(
  sessionId: string
): Promise<boolean> {
  const snap = await missedCol()
    .where("sessionId", "==", sessionId)
    .limit(1)
    .get();
  return !snap.empty;
}

// ── Detection Engine ─────────────────────────────────────────

/**
 * Scans for open sessions (active/paused) from before today
 * and flags them as missed_checkout.
 *
 * This is the core detection logic called by both the manual
 * trigger and the cron endpoint.
 *
 * Returns the list of newly detected missed checkouts.
 */
export async function detectMissedCheckouts(): Promise<MissedCheckout[]> {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const now = new Date().toISOString();

  // Find all sessions still open (working/on_break) from before today — V2 schema
  const snap = await sessionsCol()
    .where("status", "in", ["working", "on_break"])
    .where("workDate", "<", todayStr)
    .get();

  const detected: MissedCheckout[] = [];

  for (const doc of snap.docs) {
    const session = doc.data() as AttendanceSessionV2;

    // Skip if already flagged
    const alreadyFlagged = await missedCheckoutExistsForSession(session.id);
    if (alreadyFlagged) continue;

    // Close any open segment (V2: query by sessionId + isOpen, close with endAt + durationMinutes)
    const endOfDay    = `${session.workDate}T23:59:59.000Z`;
    const openSegSnap = await segmentsCol()
      .where("sessionId", "==", session.id)
      .where("isOpen", "==", true)
      .limit(1)
      .get();

    if (!openSegSnap.empty) {
      const segDoc  = openSegSnap.docs[0];
      const startAt = (segDoc.data() as { startAt: string }).startAt;
      const durationMinutes = Math.max(
        0,
        Math.round((new Date(endOfDay).getTime() - new Date(startAt).getTime()) / 60_000)
      );
      await segmentsCol().doc(segDoc.id).update({
        endAt: endOfDay,
        durationMinutes,
        isOpen: false,
      });
    }

    // Mark the session as missed_checkout (V2 fields)
    await sessionsCol().doc(session.id).update({
      status:      "missed_checkout",
      clockOutAt:  endOfDay,
      updatedAt:   now,
    });

    // Create missed checkout record
    const mcId = `mc_${session.id}`;
    const mc: MissedCheckout = {
      id:             mcId,
      sessionId:      session.id,
      employeeId:     session.userId,
      employeeName:   session.userName,
      sessionDate:    session.workDate,
      startTime:      session.clockInAt,
      detectedAt:     now,
      resolution:     "auto_closed",
      resolvedBy:     "system",
      resolvedByName: "System",
      resolvedAt:     now,
      adjustedEndTime: endOfDay,
      note: "Automatically closed at end of day. Pending admin review.",
      createdAt:  now,
      updatedAt:  now,
    };
    await createMissedCheckout(mc);

    // Send notification to the employee
    const notif = buildNotification(
      session.userId,
      "missed_checkout",
      "Missed Checkout Detected",
      `Your session on ${session.workDate} was not checked out. It has been auto-closed at 11:59 PM. Please contact your admin if you need an adjustment.`,
      "/employee/attendance",
      session.id
    );
    await createNotification(notif);

    detected.push(mc);
  }

  return detected;
}

// ── Admin Resolution ─────────────────────────────────────────

/**
 * Admin adjusts the end time for a missed checkout session.
 */
export async function resolveMissedCheckout(
  missedCheckoutId: string,
  adminUid: string,
  adminName: string,
  resolution: MissedCheckoutResolution,
  adjustedEndTime?: string,
  note?: string
): Promise<void> {
  const mc = await getMissedCheckout(missedCheckoutId);
  if (!mc) throw new Error("Missed checkout record not found.");

  const now = new Date().toISOString();
  const updates: Partial<MissedCheckout> = {
    resolution,
    resolvedBy: adminUid,
    resolvedByName: adminName,
    resolvedAt: now,
    note: note || mc.note,
  };

  if (adjustedEndTime) {
    updates.adjustedEndTime = adjustedEndTime;

    // Also update the session's endTime and recalculate work time
    const sessionRef = sessionsCol().doc(mc.sessionId);
    const sessionDoc = await sessionRef.get();
    if (sessionDoc.exists) {
      const session = sessionDoc.data()!;
      const startMs = new Date(session.startTime).getTime();
      const endMs = new Date(adjustedEndTime).getTime();
      const totalElapsed = Math.max(0, endMs - startMs);
      const breakMs = session.totalBreakMs || 0;
      const workMs = Math.max(0, totalElapsed - breakMs);

      await sessionRef.update({
        endTime: adjustedEndTime,
        totalWorkMs: workMs,
        updatedAt: now,
      });
    }
  }

  await updateMissedCheckout(missedCheckoutId, updates);

  // Notify employee
  const notif = buildNotification(
    mc.employeeId,
    "missed_checkout",
    "Missed Checkout Resolved",
    `Your missed checkout on ${mc.sessionDate} has been ${resolution === "admin_adjusted" ? "adjusted" : "resolved"} by ${adminName}.`,
    "/employee/attendance",
    mc.sessionId
  );
  await createNotification(notif);
}

// ── Cron Run Logs ────────────────────────────────────────────

export async function createCronRunLog(data: CronRunLog): Promise<void> {
  await cronCol().doc(data.id).set(data);
}

export async function getRecentCronRuns(
  jobName?: string,
  limit = 20
): Promise<CronRunLog[]> {
  let query: FirebaseFirestore.Query = cronCol()
    .orderBy("startedAt", "desc");

  if (jobName) {
    query = cronCol()
      .where("jobName", "==", jobName)
      .orderBy("startedAt", "desc");
  }

  const snap = await query.limit(limit).get();
  return snap.docs.map((d) => d.data() as CronRunLog);
}
