/**
 * app/(dashboard)/employee/payslips/page.tsx
 *
 * Employee — view their own payslips with download.
 */

import { getSession } from "@/lib/auth/withRoleGuard";
import { redirect } from "next/navigation";
import EmployeePayslipsClient from "./EmployeePayslipsClient";

export const metadata = {
  title: "My Payslips | AgencyDesk",
  description: "View your payslips and download PDFs",
};

export default async function EmployeePayslipsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <EmployeePayslipsClient />;
}
