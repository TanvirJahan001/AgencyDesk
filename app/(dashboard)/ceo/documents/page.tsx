/**
 * app/(dashboard)/ceo/documents/page.tsx
 *
 * CEO document management page (same as admin).
 */

import { getSession } from "@/lib/auth/withRoleGuard";
import { redirect } from "next/navigation";
import AdminDocumentsClient from "@/app/(dashboard)/admin/documents/AdminDocumentsClient";

export const metadata = {
  title: "Documents | CEO",
};

export default async function CEODocumentsPage() {
  const session = await getSession();

  if (!session || session.role !== "ceo") {
    redirect("/unauthorized");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Document Management</h1>
        <p className="text-gray-600">Manage employee documents and certifications</p>
      </div>
      <AdminDocumentsClient />
    </div>
  );
}
