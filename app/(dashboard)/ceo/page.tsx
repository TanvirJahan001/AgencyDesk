/**
 * app/(dashboard)/ceo/page.tsx — CEO Executive Dashboard
 *
 * KPIs:
 *   - Total employees
 *   - Working now / On break
 *   - Missed checkouts
 *   - Today's total hours
 *   - Weekly total hours
 *   - Weekly payroll estimate
 *
 * Plus a concise "today's sessions" snapshot and quick-access links.
 */

import type { Metadata } from "next";
import {
  Users,
  Clock,
  Coffee,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { adminDb } from "@/lib/firebase/admin";
import {
  getAllActiveSessions,
  getAllSessionsByDate,
  getAllSessionsByRange,
} from "@/lib/attendance/queries";
import { todayDate } from "@/lib/attendance/db";
import { minutesToDecimal, minutesToReadable, formatISO } from "@/lib/attendance/utils";
import { calculatePeriodPayroll, DEFAULT_OT_MULTIPLIER } from "@/lib/payroll/calculator";
import type { AppUser, AttendanceSessionV2 } from "@/types";

export const metadata: Metadata = { title: "CEO Dashboard" };

// ── Date helpers ──────────────────────────────────────────────

function getThisWeekRange() {
  const now = new Date();
  const day = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const mon = new Date(now);
  mon.setDate(now.getDate() - day);
  return { from: mon.toISOString().slice(0, 10), to: todayDate() };
}

// ── Data fetch ────────────────────────────────────────────────

async function getCEOData() {
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

  const totalEmployees = usersSnap.size;
  const workingNow     = activeSessions.filter((s) => s.status === "working").length;
  const onBreak        = activeSessions.filter((s) => s.status === "on_break").length;
  const missedToday    = todaySessions.filter((s) => s.status === "missed_checkout").length;

  const todayWorkMin = todaySessions.reduce(
    (sum, s) => sum + (s.totalWorkMinutes ?? 0), 0
  );
  const weekWorkMin = weekSessions.reduce(
    (sum, s) => sum + (s.totalWorkMinutes ?? 0), 0
  );

  // Payroll estimate: per-employee rates
  const userRateMap = new Map<string, { rate: number; otMult: number }>();
  for (const doc of usersSnap.docs) {
    const u = doc.data() as AppUser;
    userRateMap.set(u.uid, {
      rate:   u.hourlyRate         ?? 15,
      otMult: u.overtimeMultiplier ?? DEFAULT_OT_MULTIPLIER,
    });
  }

  const byUser = new Map<string, AttendanceSessionV2[]>();
  for (const s of weekSessions) {
    const arr = byUser.get(s.userId) ?? [];
    arr.push(s);
    byUser.set(s.userId, arr);
  }

  let weekPayEst = 0;
  for (const [uid, sessions] of Array.from(byUser)) {
    const { rate, otMult } = userRateMap.get(uid) ?? { rate: 15, otMult: 1.5 };
    weekPayEst += calculatePeriodPayroll(sessions, rate, otMult).grossPay;
  }

  return {
    totalEmployees,
    workingNow,
    onBreak,
    missedToday,
    todayWorkMin,
    weekWorkMin,
    weekPayEst,
    pendingCorrections: correctionsSnap.size,
    todaySessions,
  };
}

// ── Stat card ─────────────────────────────────────────────────

function KPI({
  icon: Icon,
  label,
  value,
  sub,
  iconCls,
  bgCls,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  iconCls: string;
  bgCls: string;
}) {
  return (
    <div className="card flex items-start gap-4">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${bgCls}`}>
        <Icon className={`h-5 w-5 ${iconCls}`} />
      </div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

// Status badge config
const STATUS_STYLE: Record<string, { cls: string; label: string }> = {
  working:         { cls: "badge-green",  label: "Working"         },
  on_break:        { cls: "badge-yellow", label: "On Break"        },
  completed:       { cls: "badge-blue",   label: "Completed"       },
  missed_checkout: { cls: "badge-red",    label: "Missed Checkout" },
};

// ── Page ──────────────────────────────────────────────────────

export default async function CEODashboardPage() {
  const data = await getCEOData().catch(() => ({
    totalEmployees:     0,
    workingNow:         0,
    onBreak:            0,
    missedToday:        0,
    todayWorkMin:       0,
    weekWorkMin:        0,
    weekPayEst:         0,
    pendingCorrections: 0,
    todaySessions:      [] as AttendanceSessionV2[],
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Executive Overview</h1>
        <p className="mt-1 text-sm text-slate-500">
          Live workforce snapshot — updated each page load.
        </p>
      </div>

      {/* KPI grid — Row 1: Workforce */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI
          icon={Users}    label="Total Employees"
          value={data.totalEmployees}
          iconCls="text-brand-600" bgCls="bg-brand-50"
        />
        <KPI
          icon={Clock}    label="Working Now"
          value={data.workingNow}  sub="clocked in"
          iconCls="text-green-600" bgCls="bg-green-50"
        />
        <KPI
          icon={Coffee}   label="On Break"
          value={data.onBreak}
          iconCls="text-orange-600" bgCls="bg-orange-50"
        />
        <KPI
          icon={AlertTriangle}  label="Missed Checkout"
          value={data.missedToday}  sub="today"
          iconCls="text-red-600" bgCls="bg-red-50"
        />
      </div>

      {/* KPI grid — Row 2: Hours & Pay */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KPI
          icon={Clock}        label="Today's Total Hours"
          value={`${minutesToDecimal(data.todayWorkMin)}h`}
          sub={minutesToReadable(data.todayWorkMin) + " across all staff"}
          iconCls="text-blue-600" bgCls="bg-blue-50"
        />
        <KPI
          icon={TrendingUp}   label="Week Total Hours"
          value={`${minutesToDecimal(data.weekWorkMin)}h`}
          sub={minutesToReadable(data.weekWorkMin) + " this week"}
          iconCls="text-indigo-600" bgCls="bg-indigo-50"
        />
        <KPI
          icon={DollarSign}   label="Weekly Payroll Est."
          value={`$${data.weekPayEst.toFixed(2)}`}
          sub={`${data.pendingCorrections} correction${data.pendingCorrections !== 1 ? "s" : ""} pending`}
          iconCls="text-purple-600" bgCls="bg-purple-50"
        />
      </div>

      {/* Today's sessions snapshot */}
      <div className="card overflow-x-auto p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Today&apos;s Sessions</h2>
          <Link href="/ceo/payroll" className="text-xs font-medium text-brand-600 hover:underline">
            Payroll →
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
              data.todaySessions.slice(0, 10).map((s) => {
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
      </div>

      {/* Quick links */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Quick Access
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { href: "/ceo/payroll",  label: "Payroll Summary",  desc: "Weekly & monthly earnings"  },
            { href: "/ceo/reports",  label: "Reports",          desc: "Export attendance & payroll" },
            { href: "/ceo/employees",label: "Employees",        desc: "Workforce overview"          },
          ].map(({ href, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/30"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">{label}</p>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
