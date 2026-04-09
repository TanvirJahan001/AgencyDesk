/**
 * app/(dashboard)/admin/contracts/page.tsx
 *
 * Admin page for managing contracts & agreements
 */

import { redirect } from "next/navigation";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import AdminContractsClient from "./AdminContractsClient";

export const metadata = {
  title: "Contracts & Agreements | AgencyDesk",
  description: "Manage employee, client, and vendor contracts",
};

export default async function AdminContractsPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  if (!hasRole(session, "admin", "ceo")) redirect("/");

  return <AdminContractsClient />;
}
