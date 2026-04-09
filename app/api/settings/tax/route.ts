/**
 * app/api/settings/tax/route.ts
 *
 * Tax Brackets and Deduction Templates API
 * - GET: Fetch all tax brackets and deduction templates
 * - POST: Create tax bracket or deduction template (admin/ceo only)
 * - PATCH: Update bracket or deduction (admin/ceo only)
 * - DELETE: Delete bracket or deduction (admin/ceo only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { safeParseBody, ok, unauthorized, forbidden, badRequest, serverError, notFound } from "@/lib/api/helpers";
import { adminDb } from "@/lib/firebase/admin";
import type { TaxBracket, DeductionTemplate } from "@/types";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const [bracketsSnapshot, deductionsSnapshot] = await Promise.all([
      adminDb.collection("tax_brackets").get(),
      adminDb.collection("deduction_templates").get(),
    ]);

    const brackets = bracketsSnapshot.docs.map((doc) => doc.data() as TaxBracket).sort((a, b) => a.name.localeCompare(b.name));
    const deductions = deductionsSnapshot.docs.map((doc) => doc.data() as DeductionTemplate).sort((a, b) => a.name.localeCompare(b.name));

    return ok({ brackets, deductions });
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    if (!hasRole(session, "admin", "ceo")) {
      return forbidden("Only admins can create tax settings");
    }

    const body = await safeParseBody<{
      type: "bracket" | "deduction";
      name?: string;
      brackets?: { min: number; max: number | null; rate: number }[];
      amount?: number;
      deductionType?: "fixed" | "percentage";
      isDefault?: boolean;
      description?: string;
    }>(req);

    if (body.type === "bracket") {
      // Create tax bracket
      if (!body.name || !Array.isArray(body.brackets) || body.brackets.length === 0) {
        return badRequest("Bracket requires: name and non-empty brackets array");
      }

      const id = adminDb.collection("tax_brackets").doc().id;
      const now = new Date().toISOString();

      const bracket: TaxBracket = {
        id,
        name: body.name.trim(),
        brackets: body.brackets.map((b) => ({
          min: b.min,
          max: b.max,
          rate: b.rate,
        })),
        createdAt: now,
        updatedAt: now,
      };

      await adminDb.collection("tax_brackets").doc(id).set(bracket);
      return ok(bracket);
    } else if (body.type === "deduction") {
      // Create deduction template
      if (!body.name || typeof body.amount !== "number" || !body.deductionType) {
        return badRequest("Deduction requires: name, amount, deductionType (fixed|percentage)");
      }

      if (!["fixed", "percentage"].includes(body.deductionType)) {
        return badRequest("deductionType must be 'fixed' or 'percentage'");
      }

      const id = adminDb.collection("deduction_templates").doc().id;
      const now = new Date().toISOString();

      const deduction: DeductionTemplate = {
        id,
        name: body.name.trim(),
        type: body.deductionType,
        amount: body.amount,
        isDefault: body.isDefault ?? false,
        description: body.description?.trim(),
        createdAt: now,
        updatedAt: now,
      };

      await adminDb.collection("deduction_templates").doc(id).set(deduction);
      return ok(deduction);
    } else {
      return badRequest("type must be 'bracket' or 'deduction'");
    }
  } catch (err) {
    return serverError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    if (!hasRole(session, "admin", "ceo")) {
      return forbidden("Only admins can update tax settings");
    }

    const body = await safeParseBody<{
      type: "bracket" | "deduction";
      id?: string;
      name?: string;
      brackets?: { min: number; max: number | null; rate: number }[];
      amount?: number;
      deductionType?: "fixed" | "percentage";
      isDefault?: boolean;
      description?: string;
    }>(req);

    if (!body.type || !body.id) {
      return badRequest("Both type and id are required");
    }

    if (body.type === "bracket") {
      const docRef = adminDb.collection("tax_brackets").doc(body.id);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        return notFound("Tax bracket not found");
      }

      const updates: Record<string, unknown> = {};

      if (body.name !== undefined) updates.name = body.name.trim();
      if (Array.isArray(body.brackets)) {
        updates.brackets = body.brackets.map((b) => ({
          min: b.min,
          max: b.max,
          rate: b.rate,
        }));
      }

      updates.updatedAt = new Date().toISOString();

      await docRef.update(updates);
      const updated = (await docRef.get()).data() as TaxBracket;
      return ok(updated);
    } else if (body.type === "deduction") {
      const docRef = adminDb.collection("deduction_templates").doc(body.id);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        return notFound("Deduction template not found");
      }

      const updates: Record<string, unknown> = {};

      if (body.name !== undefined) updates.name = body.name.trim();
      if (body.amount !== undefined) updates.amount = body.amount;
      if (body.deductionType !== undefined) {
        if (!["fixed", "percentage"].includes(body.deductionType)) {
          return badRequest("deductionType must be 'fixed' or 'percentage'");
        }
        updates.type = body.deductionType;
      }
      if (body.isDefault !== undefined) updates.isDefault = body.isDefault;
      if (body.description !== undefined) updates.description = body.description?.trim();

      updates.updatedAt = new Date().toISOString();

      await docRef.update(updates);
      const updated = (await docRef.get()).data() as DeductionTemplate;
      return ok(updated);
    } else {
      return badRequest("type must be 'bracket' or 'deduction'");
    }
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    if (!hasRole(session, "admin", "ceo")) {
      return forbidden("Only admins can delete tax settings");
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const id = searchParams.get("id");

    if (!type || !id) {
      return badRequest("Both type and id query parameters are required (?type=bracket|deduction&id=xxx)");
    }

    if (type === "bracket") {
      const docRef = adminDb.collection("tax_brackets").doc(id);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        return notFound("Tax bracket not found");
      }

      await docRef.delete();
      return ok({ id });
    } else if (type === "deduction") {
      const docRef = adminDb.collection("deduction_templates").doc(id);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        return notFound("Deduction template not found");
      }

      await docRef.delete();
      return ok({ id });
    } else {
      return badRequest("type must be 'bracket' or 'deduction'");
    }
  } catch (err) {
    return serverError(err);
  }
}
