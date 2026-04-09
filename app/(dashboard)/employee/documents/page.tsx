/**
 * app/(dashboard)/employee/documents/page.tsx
 *
 * Employee view of their own documents (read-only).
 */

import { getSession } from "@/lib/auth/withRoleGuard";
import { redirect } from "next/navigation";
import EmployeeDocumentsClient from "./EmployeeDocumentsClient";

export const metadata = {
  title: "My Documents | Employee",
};

export default async function EmployeeDocumentsPage() {
  const session = await getSession();

  if (!session || session.role !== "employee") {
    redirect("/unauthorized");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Documents</h1>
        <p className="text-gray-600">View your uploaded documents and certifications</p>
      </div>
      <EmployeeDocumentsClient />
    </div>
  );
}
