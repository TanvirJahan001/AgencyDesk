/**
 * app/(dashboard)/ceo/departments/page.tsx
 *
 * CEO Departments Management Page
 * Reuses AdminDepartmentsClient for the same functionality.
 */

import { redirect } from "next/navigation";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import AdminDepartmentsClient from "../../admin/departments/AdminDepartmentsClient";

export const metadata = {
  title: "Departments | CEO",
};

export default async function CEODepartmentsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (!hasRole(session, "ceo")) {
    redirect("/unauthorized");
  }

  return <AdminDepartmentsClient />;
}
