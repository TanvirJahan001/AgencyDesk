/**
 * app/(dashboard)/ceo/payslips/page.tsx
 *
 * CEO — view payslips (reuse admin client).
 */

import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { redirect } from "next/navigation";
import AdminPayslipsClient from "@/app/(dashboard)/admin/payslips/AdminPayslipsClient";

export const metadata = {
  title: "Payslips | AgencyDesk",
  description: "View payslips",
};

export default async function CeoPayslipsPage() {
  const session = await getSession();
  if (!session || !hasRole(session, "ceo")) redirect("/login");

  return <AdminPayslipsClient />;
}
