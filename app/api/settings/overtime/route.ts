/**
 * app/api/settings/overtime/route.ts
 *
 * Overtime Policy Configuration API
 * - GET: Fetch all overtime policies (all authenticated users)
 * - POST: Create new policy (admin/ceo only)
 * - PATCH: Update policy (admin/ceo only)
 * - DELETE: Delete policy (admin/ceo only, cannot delete default)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { safeParseBody, ok, unauthorized, forbidden, badRequest, serverError, notFound } from "@/lib/api/helpers";
import { adminDb } from "@/lib/firebase/admin";
import type { OvertimePolicy } from "@/types";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const snapshot = await adminDb.collection("overtime_policies").get();
    const policies = snapshot.docs.map((doc) => doc.data() as OvertimePolicy);

    // Sort by isDefault first, then by name
    policies.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });

    return ok(policies);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    if (!hasRole(session, "admin", "ceo")) {
      return forbidden("Only admins can create overtime policies");
    }

    const body = await safeParseBody<Partial<OvertimePolicy>>(req);

    // Validate required fields
    if (!body.name || typeof body.weeklyThresholdMinutes !== "number" || typeof body.overtimeMultiplier !== "number") {
      return badRequest("Missing required fields: name, weeklyThresholdMinutes, overtimeMultiplier");
    }

    // If setting as default, unset other defaults
    if (body.isDefault) {
      const defaultSnapshot = await adminDb
        .collection("overtime_policies")
        .where("isDefault", "==", true)
        .get();

      for (const doc of defaultSnapshot.docs) {
        await doc.ref.update({ isDefault: false, updatedAt: new Date().toISOString() });
      }
    }

    const id = adminDb.collection("overtime_policies").doc().id;
    const now = new Date().toISOString();

    const policy: OvertimePolicy = {
      id,
      name: body.name.trim(),
      weeklyThresholdMinutes: body.weeklyThresholdMinutes,
      dailyThresholdMinutes: body.dailyThresholdMinutes,
      regularMultiplier: body.regularMultiplier ?? 1.0,
      overtimeMultiplier: body.overtimeMultiplier,
      weekendMultiplier: body.weekendMultiplier,
      holidayMultiplier: body.holidayMultiplier,
      isDefault: body.isDefault ?? false,
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.collection("overtime_policies").doc(id).set(policy);

    return ok(policy);
  } catch (err) {
    return serverError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    if (!hasRole(session, "admin", "ceo")) {
      return forbidden("Only admins can update overtime policies");
    }

    const body = await safeParseBody<Partial<OvertimePolicy>>(req);

    if (!body.id) {
      return badRequest("Policy ID is required");
    }

    const docRef = adminDb.collection("overtime_policies").doc(body.id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return notFound("Overtime policy not found");
    }

    // If setting as default, unset others
    if (body.isDefault) {
      const defaultSnapshot = await adminDb
        .collection("overtime_policies")
        .where("isDefault", "==", true)
        .get();

      for (const doc of defaultSnapshot.docs) {
        if (doc.id !== body.id) {
          await doc.ref.update({ isDefault: false, updatedAt: new Date().toISOString() });
        }
      }
    }

    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.weeklyThresholdMinutes !== undefined) updates.weeklyThresholdMinutes = body.weeklyThresholdMinutes;
    if (body.dailyThresholdMinutes !== undefined) updates.dailyThresholdMinutes = body.dailyThresholdMinutes;
    if (body.regularMultiplier !== undefined) updates.regularMultiplier = body.regularMultiplier;
    if (body.overtimeMultiplier !== undefined) updates.overtimeMultiplier = body.overtimeMultiplier;
    if (body.weekendMultiplier !== undefined) updates.weekendMultiplier = body.weekendMultiplier;
    if (body.holidayMultiplier !== undefined) updates.holidayMultiplier = body.holidayMultiplier;
    if (body.isDefault !== undefined) updates.isDefault = body.isDefault;

    updates.updatedAt = new Date().toISOString();

    await docRef.update(updates);

    const updated = (await docRef.get()).data() as OvertimePolicy;
    return ok(updated);
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    if (!hasRole(session, "admin", "ceo")) {
      return forbidden("Only admins can delete overtime policies");
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return badRequest("Policy ID is required (use ?id=xxx)");
    }

    const docRef = adminDb.collection("overtime_policies").doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return notFound("Overtime policy not found");
    }

    const policy = docSnap.data() as OvertimePolicy;

    if (policy.isDefault) {
      return badRequest("Cannot delete the default overtime policy");
    }

    await docRef.delete();

    return ok({ id });
  } catch (err) {
    return serverError(err);
  }
}
