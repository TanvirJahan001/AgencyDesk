/**
 * app/(dashboard)/admin/departments/page.tsx
 *
 * Admin Departments Management Page
 * Server component that verifies admin role and renders the client.
 */

import { redirect } from "next/navigation";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import AdminDepartmentsClient from "./AdminDepartmentsClient";

export const metadata = {
  title: "Departments | Admin",
};

export default async function AdminDepartmentsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (!hasRole(session, "admin")) {
    redirect("/unauthorized");
  }

  return <AdminDepartmentsClient />;
}
