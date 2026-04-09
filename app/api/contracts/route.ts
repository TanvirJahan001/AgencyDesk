/**
 * app/api/contracts/route.ts
 *
 * GET   — List contracts. Filter by ?type= or ?partyId=. Admin/CEO only.
 * POST  — Create contract. Admin/CEO only.
 *         Required: title, type, partyName, partyType, startDate, createdByName
 *         Optional: description, fileUrl, fileName, endDate, value, currency,
 *                   renewalDate, terms, signedAt, signedBy, partyId
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
import type { Contract } from "@/types";

// ── GET ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) return forbidden("Admin or CEO access required.");

  try {
    const { searchParams } = new URL(req.url);
    const typeFilter = searchParams.get("type");
    const partyIdFilter = searchParams.get("partyId");

    // Simple fetch — no orderBy to avoid missing-index errors
    const snap = await adminDb
      .collection("contracts")
      .limit(200)
      .get();

    let contracts = snap.docs.map((d) => d.data() as Contract);

    // Apply filters
    if (typeFilter) {
      contracts = contracts.filter((c) => c.type === typeFilter);
    }
    if (partyIdFilter) {
      contracts = contracts.filter((c) => c.partyId === partyIdFilter);
    }

    // Sort by createdAt desc
    contracts.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    return ok(contracts);
  } catch (err) {
    return serverError(err);
  }
}

// ── POST ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) return forbidden("Admin or CEO access required.");

  const body = await safeParseBody<{
    title?: string;
    type?: string;
    partyName?: string;
    partyId?: string;
    partyType?: string;
    description?: string;
    fileUrl?: string;
    fileName?: string;
    startDate?: string;
    endDate?: string;
    value?: number;
    currency?: string;
    renewalDate?: string;
    terms?: string;
    signedAt?: string;
    signedBy?: string;
    createdByName?: string;
  }>(req);

  const {
    title,
    type,
    partyName,
    partyId,
    partyType,
    description,
    fileUrl,
    fileName,
    startDate,
    endDate,
    value,
    currency,
    renewalDate,
    terms,
    signedAt,
    signedBy,
    createdByName,
  } = body;

  // Validate required fields
  if (!title?.trim()) return badRequest("title is required.");
  if (!type?.trim()) return badRequest("type is required.");
  if (!partyName?.trim()) return badRequest("partyName is required.");
  if (!partyType?.trim()) return badRequest("partyType is required.");
  if (!startDate?.trim()) return badRequest("startDate is required.");
  if (!createdByName?.trim()) return badRequest("createdByName is required.");

  // Validate dates
  if (!isValidDate(startDate)) return badRequest("Invalid startDate format. Use YYYY-MM-DD.");
  if (endDate && !isValidDate(endDate)) return badRequest("Invalid endDate format. Use YYYY-MM-DD.");
  if (renewalDate && !isValidDate(renewalDate)) return badRequest("Invalid renewalDate format. Use YYYY-MM-DD.");

  try {
    const contractId = adminDb.collection("contracts").doc().id;
    const now = new Date().toISOString();

    const contract: Contract = {
      id: contractId,
      title: title.trim(),
      type: (type as Contract["type"]) || "other",
      status: "draft",
      partyName: partyName.trim(),
      partyId: partyId || undefined,
      partyType: (partyType as Contract["partyType"]) || "other",
      description: description?.trim() || undefined,
      fileUrl: fileUrl || undefined,
      fileName: fileName || undefined,
      startDate,
      endDate: endDate || undefined,
      value: value || undefined,
      currency: currency || "USD",
      renewalDate: renewalDate || undefined,
      terms: terms?.trim() || undefined,
      signedAt: signedAt || undefined,
      signedBy: signedBy || undefined,
      createdBy: session.uid,
      createdByName: createdByName.trim(),
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.collection("contracts").doc(contractId).set(contract);

    return ok(contract);
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
