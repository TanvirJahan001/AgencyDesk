/**
 * app/api/attendance/corrections/route.ts
 *
 * POST  → Employee submits a new correction request
 * GET   → Employee fetches own corrections / Admin fetches all
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/auth/withRoleGuard";
import { getSessionById } from "@/lib/attendance/queries";
import {
  createCorrection,
  getCorrectionsByEmployee,
  getAllCorrections,
  getPendingCorrections,
  hasPendingCorrection,
} from "@/lib/corrections/queries";
import { safeParseBody } from "@/lib/api/helpers";
import type {
  ApiResponse,
  CorrectionRequest,
  CorrectionChange,
} from "@/types";

function generateId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json<ApiResponse>({ success: false, error: message }, { status });
}

// ── GET: List corrections ─────────────────────────────────────

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get("session")?.value;
  if (!cookie) return errorResponse("Unauthorized.", 401);

  const user = await verifySessionCookie(cookie);
  if (!user) return errorResponse("Unauthorized.", 401);

  const { searchParams } = new URL(req.url);
  const rawStatus = searchParams.get("status");
  // "all" and empty string both mean "no filter"
  const statusFilter = rawStatus && rawStatus !== "all" ? rawStatus : undefined;

  let corrections: CorrectionRequest[];

  if (user.role === "admin" || user.role === "ceo") {
    // Admin / CEO sees all, or can filter by status
    if (statusFilter === "pending") {
      corrections = await getPendingCorrections();
    } else {
      corrections = await getAllCorrections(statusFilter);
    }
  } else {
    // Employee sees only their own
    corrections = await getCorrectionsByEmployee(user.uid, statusFilter);
  }

  return NextResponse.json<ApiResponse>({
    success: true,
    data: { corrections },
  });
}

// ── POST: Submit correction request ───────────────────────────

export async function POST(req: NextRequest) {
  const cookie = req.cookies.get("session")?.value;
  if (!cookie) return errorResponse("Unauthorized.", 401);

  const user = await verifySessionCookie(cookie);
  if (!user) return errorResponse("Unauthorized.", 401);

  const body = await safeParseBody<{
    sessionId?: string;
    reason?:    string;
    changes?:   CorrectionChange[];
  }>(req);
  const { sessionId, reason, changes } = body;

  // ── Validate inputs ──

  if (!sessionId) return errorResponse("sessionId is required.");
  if (!reason || reason.trim().length < 10) {
    return errorResponse("Please provide a reason (at least 10 characters).");
  }
  if (!changes || changes.length === 0) {
    return errorResponse("At least one change is required.");
  }

  const validFields = ["clockIn", "clockOut", "status", "date"];
  for (const c of changes) {
    if (!validFields.includes(c.field)) {
      return errorResponse(`Invalid field: ${c.field}. Allowed: ${validFields.join(", ")}`);
    }
    if (!c.newValue || c.newValue.trim() === "") {
      return errorResponse(`newValue is required for field "${c.field}".`);
    }
  }

  // ── Verify session exists and belongs to this employee ──

  const session = await getSessionById(sessionId);
  if (!session) return errorResponse("Attendance session not found.");
  if (session.userId !== user.uid) {
    return errorResponse("You can only request corrections for your own sessions.", 403);
  }

  // ── Check if the session date is in a locked payroll period ──
  const { isDateLocked } = await import("@/lib/timesheets/queries");
  if (await isDateLocked(session.workDate)) {
    return errorResponse("Cannot submit corrections — this session's payroll period is locked.");
  }

  // ── Check for duplicate pending request ──

  const alreadyPending = await hasPendingCorrection(sessionId, user.uid);
  if (alreadyPending) {
    return errorResponse(
      "You already have a pending correction for this session. Wait for admin review."
    );
  }

  // ── Create the correction request ──

  const now = new Date().toISOString();
  const correction: CorrectionRequest = {
    id:           generateId(),
    sessionId,
    employeeId:   user.uid,
    employeeName: user.name ?? user.email,
    sessionDate:  session.workDate,
    reason:       reason.trim(),
    changes,
    status:       "pending",
    reviewedBy:   null,
    reviewerName: null,
    reviewNote:   null,
    reviewedAt:   null,
    createdAt:    now,
    updatedAt:    now,
  };

  await createCorrection(correction);

  return NextResponse.json<ApiResponse>({
    success: true,
    data: { correction },
  });
}
