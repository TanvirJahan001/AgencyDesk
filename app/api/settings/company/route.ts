/**
 * app/api/settings/company/route.ts
 *
 * Company Settings API
 *   GET  — fetch company settings (all authenticated users)
 *   POST — create/update company settings (admin only)
 */

import { NextRequest } from "next/server";
import type { CompanySettings } from "@/types";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import {
  safeParseBody,
  ok,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api/helpers";

const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  id: "company_settings",
  companyName: "My Company",
  currency: "USD",
  currencySymbol: "$",
  timezone: "America/New_York",
  updatedAt: new Date().toISOString(),
  updatedBy: "system",
};

/**
 * GET /api/settings/company
 *
 * Fetch company settings. All authenticated users can read.
 * Returns default settings if no settings exist yet.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const docRef = adminDb.collection("settings").doc("company_settings");
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return ok(DEFAULT_COMPANY_SETTINGS);
    }

    return ok(docSnap.data() as CompanySettings);
  } catch (error) {
    return serverError(error);
  }
}

/**
 * POST /api/settings/company
 *
 * Create or update company settings. Admin only.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!hasRole(session, "admin")) return forbidden();

    const body = await safeParseBody<Partial<CompanySettings>>(req);

    // Validate required fields
    if (!body.companyName) {
      return badRequest("companyName is required");
    }
    if (!body.currency) {
      return badRequest("currency is required");
    }
    if (!body.currencySymbol) {
      return badRequest("currencySymbol is required");
    }
    if (!body.timezone) {
      return badRequest("timezone is required");
    }

    // Prepare document data
    const settings: CompanySettings = {
      id: "company_settings",
      companyName: body.companyName,
      companyEmail: body.companyEmail,
      companyPhone: body.companyPhone,
      companyWebsite: body.companyWebsite,
      address: body.address,
      logoUrl: body.logoUrl,
      businessHours: body.businessHours,
      fiscalYearStart: body.fiscalYearStart,
      currency: body.currency,
      currencySymbol: body.currencySymbol,
      timezone: body.timezone,
      updatedAt: new Date().toISOString(),
      updatedBy: session.uid,
    };

    // Upsert the document
    await adminDb
      .collection("settings")
      .doc("company_settings")
      .set(settings, { merge: true });

    return ok(settings);
  } catch (error) {
    return serverError(error);
  }
}
