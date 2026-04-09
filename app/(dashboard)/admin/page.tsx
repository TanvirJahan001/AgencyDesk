/**
 * app/(dashboard)/admin/page.tsx — Admin Overview Dashboard
 *
 * KPIs:
 *   - Total employees
 *   - Currently working
 *   - On break
 *   - Missed checkouts today
 *   - Weekly total hours (all employees this week)
 *   - Weekly payroll estimate (based on hourly rates)
 *
 * Plus a live snapshot table of today's sessions.
 */

import type { Metadata } from "next";
import { Users, Clock, Coffee, AlertTriangle, TrendingUp, DollarSign } from "lucide-react";
import Link from "next/link";
import { adminDb } from "@/lib/firebase/admin";
import { getAllActiveSessions, getAllSessionsByDate, getAllSessionsByRange } from "@/lib/attendance/queries";
import { todayDate } from "@/lib/attendance/db";
import { minutesToReadable, minutesToDecimal, formatISO } from "@/lib/attendance/utils";
import { calculatePeriodPayroll, DEFAULT_OT_MULTIPLIER } from "@/lib/payroll/calculator";
import StatCard from "@/components/ui/StatCard";
import type { AppUser, AttendanceSessionV2 } from "@/types";

export const metadata: Metadata = { title: "Admin Dashboard" };

// Status badge config
const STATUS_STYLE: Record<string, { cls: string; label: string }> = {
  working:         { cls: "badge-green",  label: "Working"         },
  on_break:        { cls: "badge-yellow", label: "On Break"        },
  completed:       { cls: "badge-blue",   label: "Completed"       },
  missed_checkout: { cls: "badge-red",    label: "Missed Checkout" },
};

// ── Date helpers ──────────────────────────────────────────────

function getThisWeekRange(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const mon = new Date(now);
  mon.setDate(now.getDate() - day);
  return { from: mon.toISOString().slice(0, 10), to: todayDate() };
}

// ── Server data fetch ─────────────────────────────────────────

async function getDashboardData() {
  const today = todayDate();
  const { from: weekFrom, to: weekTo } = getThisWeekRange();

  const [usersSnap, activeSessions, todaySessions, weekSessions, correctionsSnap] =
    await Promise.all([
      adminDb.collection("users").where("role", "==", "employee").get(),
      getAllActiveSessions(),
      getAllSessionsByDate(today),
      getAllSessionsByRange(weekFrom, weekTo, 1000),
      adminDb.collection("correction_requests").where("status", "==", "pending").get(),
    ]);

  // Live counts
  const totalEmployees = usersSnap.size;
  const workingNow     = activeSessions.filter((s) => s.status === "working").length;
  const onBreak        = activeSessions.filter((s) => s.status === "on_break").length;
  const missedCheckout = todaySessions.filter((s) => s.status === "missed_checkout").length;

  // Weekly totals across all employees
  const weekWorkMin = weekSessions.reduce(
    (sum, s) => sum + (s.totalWorkMinutes ?? 0), 0
  );

  // Payroll estimate: use each employee's stored rate, fallback to $15
  const userRateMap = new Map<string, { rate: number; otMult: number }>();
  for (const doc of usersSnap.docs) {
    const u = doc.data() as AppUser;
    userRateMap.set(u.uid, {
      rate:   u.hourlyRate         ?? 15,
      otMult: u.overtimeMultiplier ?? DEFAULT_OT_MULTIPLIER,
    });
  }

  // Group week sessions by user
  const byUser = new Map<string, AttendanceSessionV2[]>();
  for (const s of weekSessions) {
    const arr = byUser.get(s.userId) ?? [];
    arr.push(s);
    byUser.set(s.userId, arr);
  }

  let weeklyPayrollEst = 0;
  for (const [uid, sessions] of Array.from(byUser)) {
    const { rate, otMult } = userRateMap.get(uid) ?? { rate: 15, otMult: 1.5 };
    const result = calculatePeriodPayroll(sessions, rate, otMult);
    weeklyPayrollEst += result.grossPay;
  }

  return {
    totalEmployees,
    workingNow,
    onBreak,
    missedCheckout,
    weekWorkMin,
    weeklyPayrollEst,
    pendingCorrections: correctionsSnap.size,
    todaySessions,
  };
}

// ── Page ──────────────────────────────────────────────────────

export default async function AdminDashboardPage() {
  const data = await getDashboardData().catch(() => ({
    totalEmployees:    0,
    workingNow:        0,
    onBreak:           0,
    missedCheckout:    0,
    weekWorkMin:       0,
    weeklyPayrollEst:  0,
    pendingCorrections: 0,
    todaySessions:     [] as AttendanceSessionV2[],
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Live workforce snapshot — updated each page load.
        </p>
      </div>

      {/* Row 1: Workforce */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Employees"
          value={data.totalEmployees}
          icon={Users}
          iconColor="text-brand-600"
          iconBg="bg-brand-50"
        />
        <StatCard
          title="Working Now"
          value={data.workingNow}
          subtitle="clocked in"
          icon={Clock}
          iconColor="text-green-600"
          iconBg="bg-green-50"
        />
        <StatCard
          title="On Break"
          value={data.onBreak}
          icon={Coffee}
          iconColor="text-orange-600"
          iconBg="bg-orange-50"
        />
        <StatCard
          title="Missed Checkout"
          value={data.missedCheckout}
          subtitle="today"
          icon={AlertTriangle}
          iconColor="text-red-600"
          iconBg="bg-red-50"
        />
      </div>

      {/* Row 2: Weekly summary */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          title="Week Total Hours"
          value={`${minutesToDecimal(data.weekWorkMin)}h`}
          subtitle={`${minutesToReadable(data.weekWorkMin)} across all staff`}
          icon={TrendingUp}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatCard
          title="Weekly Payroll Est."
          value={`$${data.weeklyPayrollEst.toFixed(2)}`}
          subtitle={`${data.pendingCorrections} correction${data.pendingCorrections !== 1 ? "s" : ""} pending`}
          icon={DollarSign}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
        />
      </div>

      {/* Today's session snapshot */}
      <div className="card overflow-x-auto p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Today&apos;s Attendance</h2>
          <Link
            href="/admin/attendance"
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            View all →
          </Link>
        </div>

        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {["Employee", "Status", "Clock In", "Clock Out", "Work", "Break"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.todaySessions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  No attendance sessions recorded today.
                </td>
              </tr>
            ) : (
              data.todaySessions.slice(0, 12).map((s) => {
                const style    = STATUS_STYLE[s.status] ?? { cls: "badge-gray", label: s.status };
                const clockIn  = s.clockInAt  ? formatISO(s.clockInAt)  : "—";
                const clockOut = s.clockOutAt ? formatISO(s.clockOutAt) : "—";

                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{s.userName}</td>
                    <td className="px-4 py-3">
                      <span className={style.cls}>{style.label}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{clockIn}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{clockOut}</td>
                    <td className="px-4 py-3 tabular-nums font-medium text-blue-700">
                      {minutesToReadable(s.totalWorkMinutes ?? 0)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-orange-700">
                      {minutesToReadable(s.totalBreakMinutes ?? 0)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {data.todaySessions.length > 12 && (
          <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
            Showing 12 of {data.todaySessions.length}.{" "}
            <Link href="/admin/attendance" className="text-brand-600 hover:underline">
              See all
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
