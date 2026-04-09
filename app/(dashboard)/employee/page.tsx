/**
 * app/(dashboard)/employee/page.tsx — Employee Self-Service Dashboard
 *
 * Sections:
 *  1. KPI cards: days present this month, total work hours this week, pay estimate
 *  2. Missed checkout warning (if applicable)
 *  3. Today's Attendance — live timer + action buttons (AttendancePanel)
 *  4. This Week's Pay  — weekly earnings breakdown (WeeklySummaryCard)
 *  5. This Month's Pay — monthly earnings breakdown (MonthlySummaryCard)
 */

import type { Metadata } from "next";
import { Clock, Calendar, DollarSign } from "lucide-react";
import { getSession } from "@/lib/auth/withRoleGuard";
import { getSessionsByRange } from "@/lib/attendance/queries";
import { todayDate } from "@/lib/attendance/db";
import { minutesToReadable } from "@/lib/attendance/utils";
import { calculatePeriodPayroll } from "@/lib/payroll/calculator";
import { adminDb } from "@/lib/firebase/admin";
import StatCard from "@/components/ui/StatCard";
import AttendancePanel from "@/components/attendance/AttendancePanel";
import WeeklySummaryCard from "@/components/payroll/WeeklySummaryCard";
import MonthlySummaryCard from "@/components/payroll/MonthlySummaryCard";
import MissedCheckoutWarning from "@/components/notifications/MissedCheckoutWarning";
import type { AppUser } from "@/types";

export const metadata: Metadata = { title: "My Dashboard" };

// ── Date helpers ──────────────────────────────────────────────

function getThisMonthRange(): { from: string; to: string } {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return { from: `${year}-${month}-01`, to: todayDate() };
}

function getThisWeekRange(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay() === 0 ? 6 : now.getDay() - 1; // Mon = 0
  const mon = new Date(now);
  mon.setDate(now.getDate() - day);
  return { from: mon.toISOString().slice(0, 10), to: todayDate() };
}

// ── Server data fetch ─────────────────────────────────────────

async function getEmployeeStats(userId: string) {
  const { from: monthFrom, to: monthTo } = getThisMonthRange();
  const { from: weekFrom,  to: weekTo  } = getThisWeekRange();

  const [monthSessions, weekSessions, userDoc] = await Promise.all([
    getSessionsByRange(userId, monthFrom, monthTo, 200),
    getSessionsByRange(userId, weekFrom,  weekTo,  10),
    adminDb.collection("users").doc(userId).get(),
  ]);

  const user = userDoc.exists ? (userDoc.data() as AppUser) : null;

  // Days present = any session with work recorded this month
  const daysPresent = monthSessions.filter((s) =>
    s.status === "completed" || s.status === "working" || s.status === "on_break"
  ).length;

  // This week total work minutes (sum over all sessions — active included)
  const weekWorkMin = weekSessions.reduce(
    (sum, s) => sum + (s.totalWorkMinutes ?? 0), 0
  );

  // Estimated week pay
  const hourlyRate         = user?.hourlyRate         ?? 15;
  const overtimeMultiplier = user?.overtimeMultiplier ?? 1.5;
  const weekPayroll        = calculatePeriodPayroll(weekSessions, hourlyRate, overtimeMultiplier);

  return { daysPresent, weekWorkMin, weekGrossPay: weekPayroll.grossPay, hourlyRate };
}

// ── Page ──────────────────────────────────────────────────────

export default async function EmployeeDashboardPage() {
  const session = await getSession();
  const userId  = session?.uid ?? "";

  const stats = userId
    ? await getEmployeeStats(userId).catch(() => ({
        daysPresent:  0,
        weekWorkMin:  0,
        weekGrossPay: 0,
        hourlyRate:   15,
      }))
    : { daysPresent: 0, weekWorkMin: 0, weekGrossPay: 0, hourlyRate: 15 };

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">My Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your attendance and pay summary for this week and month.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Days Present"
          value={stats.daysPresent}
          subtitle="this month"
          icon={Calendar}
          iconColor="text-green-600"
          iconBg="bg-green-50"
        />
        <StatCard
          title="This Week"
          value={minutesToReadable(stats.weekWorkMin)}
          subtitle="total work time"
          icon={Clock}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatCard
          title="Week Earnings Est."
          value={`$${stats.weekGrossPay.toFixed(2)}`}
          subtitle={`@ $${stats.hourlyRate}/hr`}
          icon={DollarSign}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
        />
      </div>

      {/* Missed checkout warning */}
      <MissedCheckoutWarning />

      {/* ── Today's Attendance ─────────────────────────────── */}
      <div className="card">
        <h2 className="mb-5 text-base font-semibold text-slate-900">
          Today&apos;s Attendance
        </h2>
        <AttendancePanel />
      </div>

      {/* ── Pay summary cards ──────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* This Week's Pay */}
        <div className="card">
          <h2 className="mb-4 text-base font-semibold text-slate-900">
            This Week&apos;s Pay
          </h2>
          <WeeklySummaryCard />
        </div>

        {/* This Month's Pay */}
        <div className="card">
          <h2 className="mb-4 text-base font-semibold text-slate-900">
            This Month&apos;s Pay
          </h2>
          <MonthlySummaryCard />
        </div>
      </div>
    </div>
  );
}
