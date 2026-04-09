/**
 * app/api/attendance/corrections/[id]/review/route.ts
 *
 * POST — Admin approves or rejects a correction request.
 *
 * On approval:
 *   1. Updates the correction status to "approved"
 *   2. Applies the requested changes to the attendance session (transactional)
 *   3. Writes an immutable audit log entry
 *
 * On rejection:
 *   1. Updates the correction status to "rejected"
 *   2. Writes an audit log entry (no session changes)
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/auth/withRoleGuard";
import {
  getCorrection,
  updateCorrection,
  applyCorrectionsToSession,
  writeAuditLog,
} from "@/lib/corrections/queries";
import { safeParseBody } from "@/lib/api/helpers";
import type { ApiResponse, AuditLog } from "@/types";

function generateId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json<ApiResponse>({ success: false, error: message }, { status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── Auth: admin only ──

  const cookie = req.cookies.get("session")?.value;
  if (!cookie) return errorResponse("Unauthorized.", 401);

  const user = await verifySessionCookie(cookie);
  if (!user) return errorResponse("Unauthorized.", 401);
  if (user.role !== "admin") return errorResponse("Forbidden. Admin only.", 403);

  // ── Parse request ──

  const { id: correctionId } = await params;
  const body = await safeParseBody<{ action?: string; note?: string }>(req);
  const { action, note } = body;

  if (!action || !["approve", "reject"].includes(action)) {
    return errorResponse('action must be "approve" or "reject".');
  }

  // ── Load correction ──

  const correction = await getCorrection(correctionId);
  if (!correction) return errorResponse("Correction request not found.", 404);
  if (correction.status !== "pending") {
    return errorResponse(`This request has already been ${correction.status}.`);
  }

  const now      = new Date().toISOString();
  const approved = action === "approve";

  // ── If approving, apply changes to session ──

  if (approved) {
    try {
      await applyCorrectionsToSession(correction.sessionId, correction.changes);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to apply corrections.";
      return errorResponse(`Approval failed: ${msg}`, 500);
    }
  }

  // ── Update correction document ──

  await updateCorrection(correctionId, {
    status:       approved ? "approved" : "rejected",
    reviewedBy:   user.uid,
    reviewerName: user.name ?? user.email,
    reviewNote:   note?.trim() || null,
    reviewedAt:   now,
  });

  // ── Write audit log ──

  const auditEntry: AuditLog = {
    id:           generateId(),
    type:         approved ? "correction_approved" : "correction_rejected",
    correctionId: correction.id,
    sessionId:    correction.sessionId,
    employeeId:   correction.employeeId,
    adminId:      user.uid,
    adminName:    user.name ?? user.email,
    changes:      correction.changes,
    note:         note?.trim() || null,
    timestamp:    now,
  };

  await writeAuditLog(auditEntry);

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      correction: {
        ...correction,
        status:       approved ? "approved" : "rejected",
        reviewedBy:   user.uid,
        reviewerName: user.name ?? user.email,
        reviewNote:   note?.trim() || null,
        reviewedAt:   now,
      },
      auditLog: auditEntry,
    },
  });
}
