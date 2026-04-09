/**
 * GET /api/admin/payroll
 *
 * Admin/CEO only — calculate payroll for ALL employees for a period.
 *
 * Query params:
 *   type     — "weekly" | "monthly" (default: "weekly")
 *   weekStart — YYYY-MM-DD of Monday (for weekly; default: this week Monday)
 *   month    — YYYY-MM (for monthly; default: current month)
 *
 * Response 200:
 *   { success: true, data: EmployeePayrollRow[] }
 *
 *   EmployeePayrollRow = {
 *     userId, name, hourlyRate, overtimeMultiplier,
 *     regularMinutes, overtimeMinutes, grossPay,
 *     regularPay, overtimePay, totalDays
 *   }
 *
 * Error responses:
 *   401 — not authenticated
 *   403 — not admin/CEO
 *   400 — invalid params
 *   500 — server error
 */

import { type NextRequest } from "next/server";
import { verifySessionCookie } from "@/lib/auth/withRoleGuard";
import { getAllSessionsByRange } from "@/lib/attendance/queries";
import { isValidDate, isValidMonth } from "@/lib/attendance/db";
import {
  calculatePeriodPayroll,
  calculateWeeklyPayroll,
  DEFAULT_OT_MULTIPLIER,
} from "@/lib/payroll/calculator";
import { adminDb } from "@/lib/firebase/admin";
import { unauthorized, forbidden, badRequest, serverError, ok } from "@/lib/api/helpers";
import type { AppUser, AttendanceSessionV2 } from "@/types";

const PRIVILEGED       = new Set(["admin", "ceo"]);
const DEFAULT_RATE     = 15;

// ── Date helpers ──────────────────────────────────────────────

function getMondayOf(dateStr: string): string {
  const d   = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function currentWeekMonday(): string {
  return getMondayOf(new Date().toISOString().slice(0, 10));
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function monthBounds(ym: string): { start: string; end: string } {
  const [y, m] = ym.split("-").map(Number);
  const last   = new Date(Date.UTC(y, m, 0));
  return { start: `${ym}-01`, end: last.toISOString().slice(0, 10) };
}

// ── Route ─────────────────────────────────────────────────────

export interface EmployeePayrollRow {
  userId:              string;
  name:                string;
  hourlyRate:          number;
  overtimeMultiplier:  number;
  totalDays:           number;
  regularMinutes:      number;
  overtimeMinutes:     number;
  regularPay:          number;
  overtimePay:         number;
  grossPay:            number;
}

export async function GET(req: NextRequest) {
  // 1. Auth
  const cookie = req.cookies.get("session")?.value;
  if (!cookie) return unauthorized();
  const auth = await verifySessionCookie(cookie);
  if (!auth) return unauthorized();
  if (!PRIVILEGED.has(auth.role ?? "")) return forbidden();

  // 2. Parse params
  const { searchParams } = req.nextUrl;
  const type        = searchParams.get("type") ?? "weekly";
  const weekStartP  = searchParams.get("weekStart");
  const monthP      = searchParams.get("month");

  let periodStart: string;
  let periodEnd:   string;

  if (type === "monthly") {
    const month = monthP ?? currentMonth();
    if (!isValidMonth(month)) return badRequest(`Invalid "month": "${month}". Expected YYYY-MM.`);
    const bounds = monthBounds(month);
    periodStart  = bounds.start;
    periodEnd    = bounds.end;
  } else {
    // weekly (default)
    const monday = weekStartP ? getMondayOf(weekStartP) : currentWeekMonday();
    if (!isValidDate(monday)) return badRequest(`Invalid "weekStart": "${weekStartP}".`);
    periodStart  = monday;
    periodEnd    = addDays(monday, 6);
  }

  try {
    // 3. Fetch all employees
    const usersSnap = await adminDb.collection("users")
      .where("role", "==", "employee")
      .get();

    const employees = usersSnap.docs.map((d) => d.data() as AppUser);
    if (employees.length === 0) return ok<EmployeePayrollRow[]>([]);

    // 4. Fetch all completed sessions for the period across all employees
    const allSessions = await getAllSessionsByRange(periodStart, periodEnd, 1000, "completed");

    // Group sessions by userId
    const sessionsByUser = new Map<string, AttendanceSessionV2[]>();
    for (const s of allSessions) {
      const arr = sessionsByUser.get(s.userId) ?? [];
      arr.push(s);
      sessionsByUser.set(s.userId, arr);
    }

    // 5. Calculate payroll per employee
    const rows: EmployeePayrollRow[] = [];

    for (const emp of employees) {
      const empSessions = sessionsByUser.get(emp.uid) ?? [];
      const rate        = emp.hourlyRate         ?? DEFAULT_RATE;
      const otMult      = emp.overtimeMultiplier ?? DEFAULT_OT_MULTIPLIER;

      const result = type === "weekly"
        ? calculateWeeklyPayroll(empSessions, rate, otMult)
        : calculatePeriodPayroll(empSessions, rate, otMult, "Monthly");

      // Only include employees who have some work in this period
      if (result.totalDays === 0) continue;

      rows.push({
        userId:             emp.uid,
        name:               emp.displayName ?? emp.email ?? emp.uid,
        hourlyRate:         rate,
        overtimeMultiplier: otMult,
        totalDays:          result.totalDays,
        regularMinutes:     result.regularMinutes,
        overtimeMinutes:    result.overtimeMinutes,
        regularPay:         result.regularPay,
        overtimePay:        result.overtimePay,
        grossPay:           result.grossPay,
      });
    }

    // Sort by grossPay descending
    rows.sort((a, b) => b.grossPay - a.grossPay);

    return ok<EmployeePayrollRow[]>(rows);
  } catch (err) {
    return serverError(err);
  }
}
