/**
 * lib/attendance/db.ts — Firestore Collection Helpers
 *
 * Low-level Firestore access via the Admin SDK.
 * IMPORTANT: All documents use Firestore's own doc.id as the record ID.
 * We generate a deterministic ID using `sessionsCol().doc()` so the
 * document's Firestore path ID and the stored `id` field always match.
 */

import { adminDb } from "@/lib/firebase/admin";

// ── Collection references ──────────────────────────────────────

/** attendance_sessions collection */
export function sessionsCol() {
  return adminDb.collection("attendance_sessions");
}

/** attendance_segments collection */
export function segmentsCol() {
  return adminDb.collection("attendance_segments");
}

// ── ID generation ──────────────────────────────────────────────

/**
 * Generate a new unique session ID using Firestore's native ID generator.
 * This ensures the document path ID and stored `id` field always match.
 */
export function newSessionId(): string {
  return sessionsCol().doc().id;
}

/**
 * Generate a new unique segment ID using Firestore's native ID generator.
 */
export function newSegmentId(): string {
  return segmentsCol().doc().id;
}

// ── Time helpers ───────────────────────────────────────────────

/**
 * Current UTC time as ISO 8601 string.
 * e.g. "2026-04-08T09:15:00.000Z"
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Today's date as YYYY-MM-DD using the server's local clock.
 * Override with a timezone-aware library if your server runs in UTC
 * and employees are in a different timezone.
 */
export function todayDate(): string {
  const now = new Date();
  const y   = now.getFullYear();
  const m   = String(now.getMonth() + 1).padStart(2, "0");
  const d   = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Compute the integer number of minutes between two ISO timestamps.
 * Always returns >= 0; returns 0 if endISO is before startISO.
 */
export function minutesBetween(startISO: string, endISO: string): number {
  const diff = new Date(endISO).getTime() - new Date(startISO).getTime();
  return Math.max(0, Math.round(diff / 60_000));
}

/**
 * Validate that a string is a YYYY-MM-DD date.
 */
export function isValidDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/**
 * Validate that a string is a YYYY-MM month.
 */
export function isValidMonth(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}$/.test(s);
}
