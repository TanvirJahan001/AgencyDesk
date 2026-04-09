/**
 * app/(dashboard)/ceo/employees/page.tsx — CEO Employee Overview
 *
 * Read-only list: name, email, role, status, hours this week.
 */

import type { Metadata } from "next";
import { Users } from "lucide-react";
import { adminDb } from "@/lib/firebase/admin";
import type { AppUser } from "@/types";

export const metadata: Metadata = { title: "Employees" };

async function getEmployeesWithHours() {
  const weekStart = (() => {
    const d = new Date();
    const day = d.getDay() === 0 ? 6 : d.getDay() - 1;
    d.setDate(d.getDate() - day);
    return d.toISOString().slice(0, 10);
  })();

  const usersSnap = await adminDb
    .collection("users")
    .where("role", "==", "employee")
    .get();

  const users = usersSnap.docs.map((d) => d.data() as AppUser);

  // Fetch weekly sessions for all employees (V2 schema: workDate, userId, totalWorkMinutes)
  const sessionsSnap = await adminDb
    .collection("attendance_sessions")
    .where("workDate", ">=", weekStart)
    .where("status", "==", "completed")
    .get();

  // Build weekly hours map using V2 totalWorkMinutes
  const hoursMap: Record<string, number> = {};
  for (const doc of sessionsSnap.docs) {
    const data = doc.data();
    const hrs = (data.totalWorkMinutes ?? 0) / 60;
    hoursMap[data.userId] = (hoursMap[data.userId] ?? 0) + hrs;
  }

  return users.map((u) => ({
    ...u,
    weeklyHours: Math.round((hoursMap[u.uid] ?? 0) * 10) / 10,
  }));
}

export default async function CEOEmployeesPage() {
  const employees = await getEmployeesWithHours();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
          <Users className="h-5 w-5 text-brand-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Employees</h1>
          <p className="text-sm text-slate-500">
            {employees.length} employee{employees.length !== 1 ? "s" : ""} in the system
          </p>
        </div>
      </div>

      {employees.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center text-sm text-slate-400">
          No employees found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Name", "Email", "Department", "Status", "Hours This Week", "Hourly Rate"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {employees.map((emp) => (
                <tr key={emp.uid} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-900">{emp.displayName}</td>
                  <td className="px-4 py-3 text-slate-500">{emp.email}</td>
                  <td className="px-4 py-3 text-slate-500">{emp.department ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                      Active
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums font-semibold text-slate-900">
                    {emp.weeklyHours}h
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">
                    {emp.hourlyRate != null ? `$${emp.hourlyRate.toFixed(2)}/hr` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
