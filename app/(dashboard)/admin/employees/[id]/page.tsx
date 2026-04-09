/**
 * app/(dashboard)/admin/employees/[id]/page.tsx
 *
 * Admin — Individual employee detail view.
 * Shows: basic info, attendance summary (last 30 sessions), payroll runs, correction history.
 * Uses V2 schema: userId/workDate/clockInAt/clockOutAt/totalWorkMinutes/totalBreakMinutes/userName
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, DollarSign, FileEdit } from "lucide-react";
import { adminDb } from "@/lib/firebase/admin";
import type { AppUser } from "@/types";
import { minutesToDecimal, formatISO } from "@/lib/attendance/utils";

export const metadata: Metadata = { title: "Employee Details" };

async function getEmployeeDetails(uid: string) {
  // Single .where() only — sort in JS to avoid composite indexes.
  const [userDoc, sessionsSnap, payrollSnap, correctionsSnap] = await Promise.all([
    adminDb.collection("users").doc(uid).get(),
    adminDb
      .collection("attendance_sessions")
      .where("userId", "==", uid)
      .limit(200)
      .get(),
    adminDb
      .collection("payroll_runs")
      .where("employeeId", "==", uid)
      .limit(50)
      .get(),
    adminDb
      .collection("correction_requests")
      .where("employeeId", "==", uid)
      .limit(100)
      .get(),
  ]);

  if (!userDoc.exists) return null;

  const user = userDoc.data() as AppUser;

  // JS-side filtering and sorting (avoids composite index requirements)
  const sessions = sessionsSnap.docs
    .map((d) => d.data())
    .filter((s) => s.status === "completed")
    .sort((a, b) => (b.workDate || "").localeCompare(a.workDate || ""))
    .slice(0, 30);

  const payrollRuns = payrollSnap.docs
    .map((d) => d.data())
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, 5);

  const corrections = correctionsSnap.docs
    .map((d) => d.data())
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, 10);

  // V2 schema uses totalWorkMinutes / totalBreakMinutes
  const totalWorkMin  = sessions.reduce((s, sess) => s + (sess.totalWorkMinutes  ?? 0), 0);
  const totalBreakMin = sessions.reduce((s, sess) => s + (sess.totalBreakMinutes ?? 0), 0);

  return { user, sessions, payrollRuns, corrections, totalWorkMin, totalBreakMin };
}

const CORRECTION_STATUS_CLS: Record<string, string> = {
  pending:  "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const PAYROLL_STATUS_CLS: Record<string, string> = {
  draft:     "bg-slate-100 text-slate-700",
  processed: "bg-blue-100 text-blue-800",
  paid:      "bg-green-100 text-green-800",
};

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getEmployeeDetails(id);

  if (!data) notFound();

  const { user, sessions, payrollRuns, corrections, totalWorkMin, totalBreakMin } = data;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/admin/employees"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Employees
      </Link>

      {/* Identity */}
      <div className="card flex items-start gap-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-600 text-2xl font-bold text-white">
          {(user.displayName ?? user.email ?? "?").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-slate-900">{user.displayName ?? user.email}</h1>
          <p className="text-sm text-slate-500">{user.email}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {user.department && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-600">
                {user.department}
              </span>
            )}
            {user.position && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-600">
                {user.position}
              </span>
            )}
            <span className="rounded-full bg-brand-100 px-2.5 py-0.5 font-medium text-brand-700">
              {user.role}
            </span>
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="text-xs text-slate-400">Hourly Rate</p>
          <p className="text-lg font-bold text-slate-900">
            {user.hourlyRate != null ? `$${user.hourlyRate.toFixed(2)}/hr` : "—"}
          </p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
            <Clock className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Work (30 days)</p>
            <p className="text-lg font-bold text-slate-900">{minutesToDecimal(totalWorkMin)}h</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50">
            <Clock className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Break (30 days)</p>
            <p className="text-lg font-bold text-slate-900">{minutesToDecimal(totalBreakMin)}h</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
            <DollarSign className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Payroll Runs</p>
            <p className="text-lg font-bold text-slate-900">{payrollRuns.length}</p>
          </div>
        </div>
      </div>

      {/* Recent attendance — V2 schema: workDate, clockInAt, clockOutAt, totalWorkMinutes */}
      <div className="card">
        <div className="mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900">Recent Attendance (last 30 sessions)</h2>
        </div>
        {sessions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
            No attendance records.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead>
                <tr className="text-xs text-slate-500">
                  <th className="py-2 pr-4 text-left font-medium">Date</th>
                  <th className="py-2 pr-4 text-left font-medium">Clock In</th>
                  <th className="py-2 pr-4 text-left font-medium">Clock Out</th>
                  <th className="py-2 pr-4 text-right font-medium">Work</th>
                  <th className="py-2 text-right font-medium">Break</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sessions.map((sess) => (
                  <tr key={sess.id ?? sess.workDate}>
                    <td className="py-2 pr-4 font-medium text-slate-900">{sess.workDate}</td>
                    <td className="py-2 pr-4 tabular-nums text-slate-500">
                      {sess.clockInAt ? formatISO(sess.clockInAt) : "—"}
                    </td>
                    <td className="py-2 pr-4 tabular-nums text-slate-500">
                      {sess.clockOutAt ? formatISO(sess.clockOutAt) : "—"}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums font-medium text-blue-700">
                      {minutesToDecimal(sess.totalWorkMinutes ?? 0)}h
                    </td>
                    <td className="py-2 text-right tabular-nums font-medium text-orange-700">
                      {minutesToDecimal(sess.totalBreakMinutes ?? 0)}h
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payroll runs */}
      <div className="card">
        <div className="mb-4 flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900">Recent Payroll Runs</h2>
        </div>
        {payrollRuns.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
            No payroll records.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {payrollRuns.map((run) => (
              <div key={run.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{run.periodLabel ?? run.period}</p>
                  <p className="text-xs text-slate-400">
                    {run.periodType} · {minutesToDecimal(run.totalWorkMin ?? 0)}h worked
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">${(run.grossPay ?? 0).toFixed(2)}</p>
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                      PAYROLL_STATUS_CLS[run.status] ?? "bg-slate-100 text-slate-700"
                    )}
                  >
                    {run.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Correction requests */}
      <div className="card">
        <div className="mb-4 flex items-center gap-2">
          <FileEdit className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900">Correction History</h2>
        </div>
        {corrections.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
            No correction requests.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {corrections.map((cr) => (
              <div key={cr.id} className="flex items-start justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{cr.sessionDate}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{cr.reason}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                    CORRECTION_STATUS_CLS[cr.status] ?? "bg-slate-100 text-slate-700"
                  )}
                >
                  {cr.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}
