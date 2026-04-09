/**
 * app/api/leave/balances/route.ts
 *
 * GET   — Get leave balances. Admin/CEO see all. Employees see own.
 *         Query: ?employeeId=x&year=2026
 * POST  — Admin only. Initialize or update leave balances.
 *         Body: { employeeId, year, annual: { total }, sick: { total }, personal: { total } }
 */

import { NextRequest } from "next/server";
import type { firestore as FirebaseFirestore } from "firebase-admin";
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
import type { LeaveBalance } from "@/types";

// ── GET ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId");
    const mine = searchParams.get("mine") === "true";
    const year = searchParams.get("year") ? parseInt(searchParams.get("year")!, 10) : new Date().getFullYear();

    // Single .where() max — year filtering done in JS to avoid composite index.
    let query: FirebaseFirestore.Query = adminDb.collection("leave_balances");

    // Use employeeId as the single Firestore filter when applicable
    if (mine) {
      query = query.where("employeeId", "==", session.uid);
    } else if (!hasRole(session, "admin", "ceo")) {
      query = query.where("employeeId", "==", session.uid);
    } else if (employeeId) {
      query = query.where("employeeId", "==", employeeId);
    }

    const rawSnap = await query.limit(500).get();
    // JS-side year filter
    const filteredDocs = rawSnap.docs.filter((d) => d.data().year === year);
    let snap = { empty: filteredDocs.length === 0, docs: filteredDocs } as unknown as FirebaseFirestore.QuerySnapshot;

    // Auto-create default balance for current user if mine=true and no record exists
    if (snap.empty && (mine || !hasRole(session, "admin", "ceo"))) {
      const balanceId = adminDb.collection("leave_balances").doc().id;
      const defaultBalance: LeaveBalance = {
        id: balanceId,
        employeeId: session.uid,
        year,
        annual:   { total: 20, used: 0, remaining: 20 },
        sick:     { total: 10, used: 0, remaining: 10 },
        personal: { total: 5,  used: 0, remaining: 5  },
        updatedAt: new Date().toISOString(),
      };
      await adminDb.collection("leave_balances").doc(balanceId).set(defaultBalance);

      // Return the just-created balance directly (no re-fetch needed)
      return ok([defaultBalance]);
    }

    const balances = snap.docs.map((d) => d.data() as LeaveBalance);

    return ok(balances);
  } catch (err) {
    return serverError(err);
  }
}

// ── POST ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) return forbidden("Admin/CEO access required.");

  const body = await safeParseBody<{
    employeeId?: string;
    year?: number;
    annual?: { total?: number };
    sick?: { total?: number };
    personal?: { total?: number };
  }>(req);

  const { employeeId, year, annual, sick, personal } = body;

  if (!employeeId?.trim()) return badRequest("employeeId is required.");
  if (!year) return badRequest("year is required.");

  const annualTotal = annual?.total ?? 0;
  const sickTotal = sick?.total ?? 0;
  const personalTotal = personal?.total ?? 0;

  try {
    // Check if balance already exists for this employee/year
    // Single .where() + JS-side year filter to avoid composite index.
    const existingSnap = await adminDb
      .collection("leave_balances")
      .where("employeeId", "==", employeeId)
      .limit(50)
      .get();
    const existingDocs = existingSnap.docs.filter((d) => d.data().year === year);
    const existing = { empty: existingDocs.length === 0, docs: existingDocs };

    const now = new Date().toISOString();

    if (!existing.empty) {
      // Update existing record
      const docId = existing.docs[0].id;
      const existingData = existing.docs[0].data() as LeaveBalance;

      const updated: Partial<LeaveBalance> = {
        annual: {
          total: annualTotal,
          used: existingData.annual.used,
          remaining: annualTotal - existingData.annual.used,
        },
        sick: {
          total: sickTotal,
          used: existingData.sick.used,
          remaining: sickTotal - existingData.sick.used,
        },
        personal: {
          total: personalTotal,
          used: existingData.personal.used,
          remaining: personalTotal - existingData.personal.used,
        },
        updatedAt: now,
      };

      await adminDb.collection("leave_balances").doc(docId).update(updated);
      return ok(updated);
    }

    // Create new record
    const balanceId = adminDb.collection("leave_balances").doc().id;
    const newBalance: LeaveBalance = {
      id: balanceId,
      employeeId,
      year,
      annual: { total: annualTotal, used: 0, remaining: annualTotal },
      sick: { total: sickTotal, used: 0, remaining: sickTotal },
      personal: { total: personalTotal, used: 0, remaining: personalTotal },
      updatedAt: now,
    };

    await adminDb.collection("leave_balances").doc(balanceId).set(newBalance);
    return ok(newBalance);
  } catch (err) {
    return serverError(err);
  }
}
