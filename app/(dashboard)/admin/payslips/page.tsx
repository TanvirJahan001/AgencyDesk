/**
 * app/(dashboard)/admin/payslips/page.tsx
 *
 * Admin — manage all payslips.
 */

import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { redirect } from "next/navigation";
import AdminPayslipsClient from "./AdminPayslipsClient";

export const metadata = {
  title: "Payslips | AgencyDesk",
  description: "Manage and generate payslips",
};

export default async function AdminPayslipsPage() {
  const session = await getSession();
  if (!session || !hasRole(session, "admin")) redirect("/login");

  return <AdminPayslipsClient />;
}
