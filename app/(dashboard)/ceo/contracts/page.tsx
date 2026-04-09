/**
 * app/(dashboard)/ceo/contracts/page.tsx
 *
 * CEO page for viewing contracts & agreements
 */

import { redirect } from "next/navigation";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import AdminContractsClient from "../../admin/contracts/AdminContractsClient";

export const metadata = {
  title: "Contracts & Agreements | AgencyDesk",
  description: "View and manage contracts",
};

export default async function CeoContractsPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  if (!hasRole(session, "ceo")) redirect("/");

  return <AdminContractsClient />;
}
