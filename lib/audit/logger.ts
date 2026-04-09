/**
 * lib/audit/logger.ts
 *
 * Reusable audit log writer for server-side operations.
 * Use this in API routes and server actions to log all state mutations.
 *
 * Example:
 *   await writeAuditLog({
 *     type: "correction_approved",
 *     correctionId: "corr_123",
 *     sessionId: "sess_456",
 *     employeeId: "emp_789",
 *     adminId: "admin_001",
 *     adminName: "John Doe",
 *     changes: [{ field: "clockIn", oldValue: "09:15", newValue: "08:55" }],
 *     note: "Approved due to verified doctor's appointment",
 *   });
 */

import { adminDb } from "@/lib/firebase/admin";
import type { AuditLog } from "@/types";

export async function writeAuditLog(
  log: Omit<AuditLog, "id" | "timestamp">
): Promise<AuditLog> {
  const id = adminDb.collection("audit_logs").doc().id;
  const entry: AuditLog = {
    ...log,
    id,
    timestamp: new Date().toISOString(),
  };

  await adminDb.collection("audit_logs").doc(id).set(entry);
  return entry;
}
