/**
 * GET /api/analytics
 *
 * Admin/CEO only — fetch aggregated analytics data for the dashboard.
 *
 * Returns:
 *   {
 *     success: true,
 *     data: {
 *       employeeCount: number,
 *       departmentBreakdown: { department: string; count: number }[],
 *       attendanceRate: number,         // percentage of employees who clocked in today
 *       leaveRequestsThisMonth: number,
 *       pendingLeaves: number,
 *       expensesThisMonth: number,      // total amount
 *       pendingExpenses: number,
 *       activeProjects: number,
 *       payrollThisMonth: number,       // total gross pay processed
 *       recentHires: number,            // employees created in last 30 days
 *       contractsExpiringSoon: number,  // contracts expiring within 30 days
 *     }
 *   }
 *
 * Error responses:
 *   401 — not authenticated
 *   403 — caller is not admin or CEO
 *   500 — server error
 */

import { type NextRequest } from "next/server";
import { verifySessionCookie } from "@/lib/auth/withRoleGuard";
import { unauthorized, forbidden, serverError, ok } from "@/lib/api/helpers";
import { adminDb } from "@/lib/firebase/admin";

interface AnalyticsData {
  employeeCount: number;
  departmentBreakdown: { department: string; count: number }[];
  attendanceRate: number;
  leaveRequestsThisMonth: number;
  pendingLeaves: number;
  expensesThisMonth: number;
  pendingExpenses: number;
  activeProjects: number;
  payrollThisMonth: number;
  recentHires: number;
  contractsExpiringSoon: number;
}

const PRIVILEGED = new Set(["admin", "ceo"]);

export async function GET(req: NextRequest) {
  try {
    // 1. Auth check
    const cookie = req.cookies.get("session")?.value;
    if (!cookie) return unauthorized();

    const auth = await verifySessionCookie(cookie);
    if (!auth) return unauthorized();

    if (!PRIVILEGED.has(auth.role ?? "")) return forbidden();

    // 2. Get current date info
    const today = new Date();
    const currentMonth = today.toISOString().slice(0, 7); // YYYY-MM
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const todayString = today.toISOString().slice(0, 10); // YYYY-MM-DD

    // 3. Fetch employee count and department breakdown
    const usersSnap = await adminDb
      .collection("users")
      .where("role", "==", "employee")
      .get();

    const employeeCount = usersSnap.size;

    // Build department breakdown
    const deptMap = new Map<string, number>();
    usersSnap.forEach((doc) => {
      const dept = doc.data().department || "Unassigned";
      deptMap.set(dept, (deptMap.get(dept) ?? 0) + 1);
    });

    const departmentBreakdown = Array.from(deptMap.entries()).map(
      ([department, count]) => ({
        department,
        count,
      })
    );

    // 4. Attendance rate today (employees who clocked in today)
    let attendanceRate = 0;
    if (employeeCount > 0) {
      const attendanceSnap = await adminDb
        .collection("attendance_sessions")
        .where("date", "==", todayString)
        .get();

      const clockedInCount = attendanceSnap.size;
      attendanceRate = Math.round((clockedInCount / employeeCount) * 100);
    }

    // 5. Leave requests this month
    // Plain fetch + JS-side date filter to avoid composite index on createdAt range.
    const allLeavesSnap = await adminDb
      .collection("leave_requests")
      .limit(1000)
      .get();
    const monthStartStr = new Date(currentMonth + "-01").toISOString();
    const monthEndStr = new Date(currentMonth + "-31T23:59:59").toISOString();

    const leaveRequestsThisMonth = allLeavesSnap.docs.filter((doc) => {
      const created = doc.data().createdAt || "";
      return created >= monthStartStr && created <= monthEndStr;
    }).length;

    // 6. Pending leaves
    const pendingLeavesSnap = await adminDb
      .collection("leave_requests")
      .where("status", "==", "pending")
      .get();

    const pendingLeaves = pendingLeavesSnap.size;

    // 7. Expenses this month and pending expenses
    // Plain fetch + JS-side filtering to avoid composite indexes.
    const allExpensesSnap = await adminDb
      .collection("expenses")
      .limit(1000)
      .get();

    let expensesThisMonth = 0;
    let pendingExpenses = 0;
    allExpensesSnap.forEach((doc) => {
      const data = doc.data();
      const created = data.createdAt || "";
      if (created >= monthStartStr && created <= monthEndStr) {
        expensesThisMonth += data.amount || 0;
      }
      if (data.status === "pending") {
        pendingExpenses += data.amount || 0;
      }
    });

    // 8. Active projects
    const projectsSnap = await adminDb
      .collection("projects")
      .where("status", "==", "active")
      .get();

    const activeProjects = projectsSnap.size;

    // 9. Payroll this month (total gross pay processed)
    const payrollSnap = await adminDb
      .collection("payroll")
      .where("period", "==", currentMonth)
      .get();

    let payrollThisMonth = 0;
    payrollSnap.forEach((doc) => {
      const baseSalary = doc.data().baseSalary || 0;
      const overtime = doc.data().overtime || 0;
      payrollThisMonth += baseSalary + overtime;
    });

    // 10. Recent hires (employees created in last 30 days)
    // Reuse the usersSnap we already fetched (all employees) — filter in JS
    // to avoid needing a composite index on role + createdAt.
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();
    let recentHires = 0;
    usersSnap.forEach((doc) => {
      const created = doc.data().createdAt || "";
      if (created >= thirtyDaysAgoStr) recentHires++;
    });

    // 11. Contracts expiring soon (within 30 days)
    // Fetch all active contracts and filter in JS to avoid composite index
    const contractsSnap = await adminDb
      .collection("contracts")
      .limit(500)
      .get();

    const todayStr = today.toISOString().slice(0, 10);
    const thirtyDaysFromNowStr = thirtyDaysFromNow.toISOString().slice(0, 10);
    let contractsExpiringSoon = 0;
    contractsSnap.forEach((doc) => {
      const d = doc.data();
      if (d.status === "active" && d.endDate && d.endDate >= todayStr && d.endDate <= thirtyDaysFromNowStr) {
        contractsExpiringSoon++;
      }
    });

    // 12. Return data
    const data: AnalyticsData = {
      employeeCount,
      departmentBreakdown,
      attendanceRate,
      leaveRequestsThisMonth,
      pendingLeaves,
      expensesThisMonth,
      pendingExpenses,
      activeProjects,
      payrollThisMonth,
      recentHires,
      contractsExpiringSoon,
    };

    return ok<AnalyticsData>(data);
  } catch (err) {
    return serverError(err);
  }
}
