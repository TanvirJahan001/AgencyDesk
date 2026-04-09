/**
 * app/api/contracts/[id]/route.ts
 *
 * PATCH  — Update contract. Admin/CEO only.
 *          Can update: status, title, type, partyName, description, fileUrl,
 *          fileName, endDate, value, currency, renewalDate, terms, signedAt, signedBy
 * DELETE — Delete contract. Admin/CEO only.
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
import type { Contract } from "@/types";

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
    status?: string;
    title?: string;
    type?: string;
    partyName?: string;
    description?: string;
    fileUrl?: string;
    fileName?: string;
    endDate?: string;
    value?: number;
    currency?: string;
    renewalDate?: string;
    terms?: string;
    signedAt?: string;
    signedBy?: string;
  }>(req);

  try {
    const doc = await adminDb.collection("contracts").doc(id).get();
    if (!doc.exists) return notFound("Contract not found.");

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    // Validate dates if provided
    if (body.endDate !== undefined && body.endDate && !isValidDate(body.endDate)) {
      return badRequest("Invalid endDate format. Use YYYY-MM-DD.");
    }
    if (body.renewalDate !== undefined && body.renewalDate && !isValidDate(body.renewalDate)) {
      return badRequest("Invalid renewalDate format. Use YYYY-MM-DD.");
    }

    // Apply updates
    if (body.status !== undefined) updates.status = body.status;
    if (body.title !== undefined) updates.title = body.title;
    if (body.type !== undefined) updates.type = body.type;
    if (body.partyName !== undefined) updates.partyName = body.partyName;
    if (body.description !== undefined) updates.description = body.description;
    if (body.fileUrl !== undefined) updates.fileUrl = body.fileUrl;
    if (body.fileName !== undefined) updates.fileName = body.fileName;
    if (body.endDate !== undefined) updates.endDate = body.endDate || null;
    if (body.value !== undefined) updates.value = body.value;
    if (body.currency !== undefined) updates.currency = body.currency;
    if (body.renewalDate !== undefined) updates.renewalDate = body.renewalDate || null;
    if (body.terms !== undefined) updates.terms = body.terms;
    if (body.signedAt !== undefined) updates.signedAt = body.signedAt || null;
    if (body.signedBy !== undefined) updates.signedBy = body.signedBy || null;

    if (Object.keys(updates).length === 1) {
      return badRequest("No valid fields provided to update.");
    }

    await adminDb.collection("contracts").doc(id).update(updates);

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
    const doc = await adminDb.collection("contracts").doc(id).get();
    if (!doc.exists) return notFound("Contract not found.");

    await adminDb.collection("contracts").doc(id).delete();

    return ok({ id, deleted: true });
  } catch (err) {
    return serverError(err);
  }
}

// ── Helper ───────────────────────────────────────────────────

function isValidDate(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = new Date(dateStr + "T00:00:00Z");
  return !isNaN(date.getTime());
}
