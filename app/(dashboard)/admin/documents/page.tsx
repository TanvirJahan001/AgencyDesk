/**
 * app/(dashboard)/admin/documents/page.tsx
 *
 * Admin document management page.
 */

import { getSession } from "@/lib/auth/withRoleGuard";
import { redirect } from "next/navigation";
import AdminDocumentsClient from "./AdminDocumentsClient";

export const metadata = {
  title: "Documents | Admin",
};

export default async function AdminDocumentsPage() {
  const session = await getSession();

  if (!session || session.role !== "admin") {
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
