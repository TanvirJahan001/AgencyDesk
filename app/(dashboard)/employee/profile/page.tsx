/**
 * app/(dashboard)/employee/profile/page.tsx
 *
 * Server-rendered wrapper for employee profile page.
 * Fetches the user's profile from Firestore and renders the client component.
 */

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { verifySessionCookie } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import EmployeeProfileClient from "@/components/profile/EmployeeProfileClient";
import type { AppUser } from "@/types";

export const metadata: Metadata = { title: "My Profile" };

export default async function EmployeeProfilePage() {
  const cookieStore = await cookies();
  const session = await verifySessionCookie(cookieStore.get("session")?.value ?? "");

  if (!session) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        Unable to load profile. Please refresh or log in again.
      </div>
    );
  }

  try {
    const userDoc = await adminDb.collection("users").doc(session.uid).get();
    const user = userDoc.data() as AppUser;

    if (!user) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          User profile not found.
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Profile</h1>
          <p className="mt-1 text-slate-600">Manage your account settings and personal information.</p>
        </div>
        <EmployeeProfileClient initialUser={user} isAdmin={false} />
      </div>
    );
  } catch (error) {
    console.error("Failed to load profile:", error);
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        Failed to load profile. Please try again later.
      </div>
    );
  }
}
