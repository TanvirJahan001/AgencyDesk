/**
 * lib/corrections/queries.ts — Server-side Firestore CRUD for corrections
 *
 * Used exclusively by API route handlers (Admin SDK).
 * All queries use at most ONE .where() — sorting/filtering done in JS
 * to avoid composite index requirements.
 */

import { adminDb } from "@/lib/firebase/admin";
import type { CorrectionRequest, AuditLog } from "@/types";

const correctionsCol = () => adminDb.collection("correction_requests");
const auditCol       = () => adminDb.collection("audit_logs");
const sessionsCol    = () => adminDb.collection("attendance_sessions");

// ── Correction Queries ────────────────────────────────────────

export async function createCorrection(
  data: CorrectionRequest
): Promise<CorrectionRequest> {
  await correctionsCol().doc(data.id).set(data);
  return data;
}

export async function getCorrection(
  id: string
): Promise<CorrectionRequest | null> {
  const doc = await correctionsCol().doc(id).get();
  return doc.exists ? (doc.data() as CorrectionRequest) : null;
}

export async function updateCorrection(
  id: string,
  data: Partial<CorrectionRequest>
): Promise<void> {
  await correctionsCol().doc(id).update({
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

/** Employee: get my correction requests, optionally filtered by status. */
export async function getCorrectionsByEmployee(
  employeeId: string,
  status?: string
): Promise<CorrectionRequest[]> {
  // Single .where() + JS-side sort/filter to avoid composite index.
  const snap = await correctionsCol()
    .where("employeeId", "==", employeeId)
    .limit(200)
    .get();

  let results = snap.docs.map((d) => d.data() as CorrectionRequest);

  if (status) {
    results = results.filter((r) => r.status === status);
  }

  results.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return results.slice(0, 50);
}

/** Admin: get all pending correction requests. */
export async function getPendingCorrections(): Promise<CorrectionRequest[]> {
  // Single .where() + JS-side sort.
  const snap = await correctionsCol()
    .where("status", "==", "pending")
    .limit(500)
    .get();

  const results = snap.docs.map((d) => d.data() as CorrectionRequest);
  results.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  return results;
}

/** Admin: get all correction requests, optionally filtered. */
export async function getAllCorrections(
  status?: string
): Promise<CorrectionRequest[]> {
  let snap;

  if (status) {
    snap = await correctionsCol()
      .where("status", "==", status)
      .limit(500)
      .get();
  } else {
    snap = await correctionsCol().limit(500).get();
  }

  const results = snap.docs.map((d) => d.data() as CorrectionRequest);
  results.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return results.slice(0, 100);
}

/** Check if a pending request already exists for a session by this employee. */
export async function hasPendingCorrection(
  sessionId: string,
  employeeId: string
): Promise<boolean> {
  // Single .where() + JS-side filter to avoid composite index.
  const snap = await correctionsCol()
    .where("sessionId", "==", sessionId)
    .limit(50)
    .get();

  return snap.docs.some(
    (d) => d.data().employeeId === employeeId && d.data().status === "pending"
  );
}

// ── Audit Log ─────────────────────────────────────────────────

export async function writeAuditLog(data: AuditLog): Promise<void> {
  await auditCol().doc(data.id).set(data);
}

export async function getAuditLogsBySession(
  sessionId: string
): Promise<AuditLog[]> {
  // Single .where() + JS-side sort.
  const snap = await auditCol()
    .where("sessionId", "==", sessionId)
    .limit(200)
    .get();

  const results = snap.docs.map((d) => d.data() as AuditLog);
  results.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  return results;
}

export async function getAuditLogsByCorrection(
  correctionId: string
): Promise<AuditLog[]> {
  // Single .where() + JS-side sort.
  const snap = await auditCol()
    .where("correctionId", "==", correctionId)
    .limit(200)
    .get();

  const results = snap.docs.map((d) => d.data() as AuditLog);
  results.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  return results;
}

// ── Session Update (used on approval) ─────────────────────────

/**
 * Applies approved correction changes to the attendance session.
 * This is a transactional update — reads the session, applies changes,
 * recalculates totals if needed, and writes back atomically.
 */
export async function applyCorrectionsToSession(
  sessionId: string,
  changes: { field: string; newValue: string }[]
): Promise<void> {
  const sessionRef = sessionsCol().doc(sessionId);

  await adminDb.runTransaction(async (txn) => {
    const doc = await txn.get(sessionRef);
    if (!doc.exists) throw new Error(`Session ${sessionId} not found.`);

    const session = doc.data()!;
    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    for (const change of changes) {
      switch (change.field) {
        case "clockIn":
        case "startTime":
          updates.startTime = new Date(change.newValue).toISOString();
          break;
        case "clockOut":
        case "endTime":
          updates.endTime = new Date(change.newValue).toISOString();
          break;
        case "status":
          updates.status = change.newValue;
          break;
        case "date":
          updates.date = change.newValue;
          break;
        default:
          // Unknown field — skip safely
          break;
      }
    }

    // Recalculate totalWorkMs if both start and end times are available
    const finalStart = (updates.startTime as string) ?? session.startTime;
    const finalEnd   = (updates.endTime as string)   ?? session.endTime;

    if (finalStart && finalEnd) {
      const totalElapsed = new Date(finalEnd).getTime() - new Date(finalStart).getTime();
      const breakMs      = session.totalBreakMs ?? 0;
      updates.totalWorkMs = Math.max(0, totalElapsed - breakMs);
    }

    txn.update(sessionRef, updates);
  });
}
