/**
 * app/(dashboard)/ceo/onboarding/page.tsx
 *
 * Server component: CEO view of onboarding/offboarding (reuses admin client)
 */

import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import type { AppUser } from "@/types";
import { redirect } from "next/navigation";
import { OnboardingClient } from "../../admin/onboarding/OnboardingClient";

export default async function CEOOnboardingPage() {
  const session = await getSession();

  // Require CEO
  if (!hasRole(session, "ceo")) {
    redirect("/unauthorized");
  }

  // Fetch all employees
  const usersSnapshot = await adminDb
    .collection("users")
    .where("role", "==", "employee")
    .get();

  const employees: AppUser[] = usersSnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      uid: data.uid,
      email: data.email,
      displayName: data.displayName,
      role: data.role,
      department: data.department,
      position: data.position,
      createdAt: data.createdAt,
      photoURL: data.photoURL,
      payType: data.payType,
      salaryAmount: data.salaryAmount,
      hourlyRate: data.hourlyRate,
      overtimeMultiplier: data.overtimeMultiplier,
      weeklyOvertimeThresholdMin: data.weeklyOvertimeThresholdMin,
    } as AppUser;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Onboarding & Offboarding
        </h1>
        <p className="text-gray-500 mt-2">
          Manage employee onboarding and offboarding processes
        </p>
      </div>

      <OnboardingClient employees={employees} />
    </div>
  );
}
