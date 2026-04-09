/**
 * app/(dashboard)/admin/employees/page.tsx
 *
 * Admin — Employee roster with live Firestore data.
 * Client component for add / edit / deactivate.
 */

import type { Metadata } from "next";
import AdminEmployeeList from "@/components/employees/AdminEmployeeList";

export const metadata: Metadata = { title: "Employees" };

export default function AdminEmployeesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Employees</h1>
        <p className="mt-1 text-sm text-slate-500">
          Add, edit, and manage your workforce.
        </p>
      </div>
      <AdminEmployeeList />
    </div>
  );
}
