/**
 * app/(dashboard)/admin/settings/company/page.tsx
 *
 * Company Settings & Branding Page
 * Server component that fetches initial settings and renders the client form
 */

import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import { redirect } from "next/navigation";
import type { CompanySettings } from "@/types";
import CompanySettingsClient from "./CompanySettingsClient";

const DEFAULT_SETTINGS: CompanySettings = {
  id: "company_settings",
  companyName: "My Company",
  currency: "USD",
  currencySymbol: "$",
  timezone: "America/New_York",
  updatedAt: new Date().toISOString(),
  updatedBy: "system",
};

export default async function CompanySettingsPage() {
  // Check authentication and authorization
  const session = await getSession();
  if (!session || !hasRole(session, "admin")) {
    redirect("/unauthorized");
  }

  // Fetch current settings from Firestore
  let settings = DEFAULT_SETTINGS;
  try {
    const docSnap = await adminDb
      .collection("settings")
      .doc("company_settings")
      .get();

    if (docSnap.exists) {
      settings = docSnap.data() as CompanySettings;
    }
  } catch (error) {
    console.error("Failed to fetch company settings:", error);
    // Continue with defaults on error
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          Company & Branding
        </h1>
        <p className="text-slate-600 mt-2">
          Configure company information, branding, business hours, and financial
          settings
        </p>
      </div>

      <CompanySettingsClient initialSettings={settings} />
    </div>
  );
}
