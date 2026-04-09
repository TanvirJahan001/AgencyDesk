/**
 * app/api/dashboard/stats/route.ts
 *
 * GET — Admin/CEO only. Return financial dashboard stats.
 *       - totalRevenue: sum of all paid invoices
 *       - totalExpenses: sum of all approved expenses
 *       - profit: totalRevenue - totalExpenses
 *       - outstandingInvoices: sum of issued (unpaid) invoices
 *       - activeProjects: count of projects with status "active"
 *       - activeClients: count of clients with status "active"
 *       - teamUtilization: (total logged minutes this month) / (possible minutes)
 *       - revenueByMonth: last 6 months
 *       - topClients: top 5 by paid invoice amount
 */

import { NextRequest } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import {
  unauthorized,
  forbidden,
  serverError,
  ok,
} from "@/lib/api/helpers";
import type { Invoice, Expense, Project, Client, TimeLog, AppUser } from "@/types";

// ── GET ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) return forbidden("Admin or CEO access required.");

  try {
    // Get all invoices
    const invoicesSnap = await adminDb.collection("invoices").get();
    const invoices = invoicesSnap.docs.map((d) => d.data() as Invoice);

    // Get all approved expenses
    const expensesSnap = await adminDb.collection("expenses").where("status", "==", "approved").get();
    const expenses = expensesSnap.docs.map((d) => d.data() as Expense);

    // Get all projects
    const projectsSnap = await adminDb.collection("projects").get();
    const projects = projectsSnap.docs.map((d) => d.data() as Project);

    // Get all clients
    const clientsSnap = await adminDb.collection("clients").get();
    const clients = clientsSnap.docs.map((d) => d.data() as Client);

    // Get all employees for team utilization
    const employeesSnap = await adminDb.collection("users").where("role", "==", "employee").get();
    const employees = employeesSnap.docs.map((d) => d.data() as AppUser);

    // Get time logs for this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    // Plain fetch + JS-side date filter to avoid composite index on date range.
    const timeLogsSnap = await adminDb
      .collection("time_logs")
      .limit(2000)
      .get();
    const timeLogs = timeLogsSnap.docs
      .map((d) => d.data() as TimeLog)
      .filter((l) => (l.date || "") >= monthStart && (l.date || "") <= monthEnd);

    // Calculate stats
    const totalRevenue = invoices
      .filter((inv) => inv.status === "paid")
      .reduce((sum, inv) => sum + inv.total, 0);

    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const profit = totalRevenue - totalExpenses;

    const outstandingInvoices = invoices
      .filter((inv) => inv.status === "issued")
      .reduce((sum, inv) => sum + inv.total, 0);

    const activeProjects = projects.filter((p) => p.status === "active").length;
    const activeClients = clients.filter((c) => c.status === "active").length;

    // Team utilization: (total logged minutes this month) / (employee count * 22 days * 480 min)
    const totalLoggedMinutes = timeLogs.reduce((sum, log) => sum + log.minutes, 0);
    const possibleMinutes = employees.length * 22 * 480; // 22 working days, 8 hours = 480 min
    const teamUtilization = possibleMinutes > 0 ? (totalLoggedMinutes / possibleMinutes) * 100 : 0;

    // Revenue by month (last 6 months)
    const revenueByMonth = Array.from({ length: 6 }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const monthStr = date.toISOString().split("T")[0].substring(0, 7); // YYYY-MM

      const monthRevenue = invoices
        .filter((inv) => inv.status === "paid" && inv.createdAt.substring(0, 7) === monthStr)
        .reduce((sum, inv) => sum + inv.total, 0);

      const monthExpenses = expenses
        .filter((exp) => exp.date.substring(0, 7) === monthStr)
        .reduce((sum, exp) => sum + exp.amount, 0);

      return {
        month: monthStr,
        revenue: monthRevenue,
        expenses: monthExpenses,
        profit: monthRevenue - monthExpenses,
      };
    });

    // Top 5 clients by paid invoice amount
    const clientRevenue = new Map<string, { clientId: string; clientName: string; total: number }>();

    invoices
      .filter((inv) => inv.status === "paid")
      .forEach((inv) => {
        if (!clientRevenue.has(inv.projectId || "")) {
          const project = projects.find((p) => p.id === inv.projectId);
          clientRevenue.set(inv.projectId || "", {
            clientId: project?.clientId || "",
            clientName: project?.clientName || "Unknown",
            total: 0,
          });
        }
        const entry = clientRevenue.get(inv.projectId || "")!;
        entry.total += inv.total;
      });

    const topClients = Array.from(clientRevenue.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const stats = {
      totalRevenue,
      totalExpenses,
      profit,
      outstandingInvoices,
      activeProjects,
      activeClients,
      teamUtilization: Math.round(teamUtilization * 100) / 100,
      revenueByMonth,
      topClients,
    };

    return ok(stats);
  } catch (err) {
    return serverError(err);
  }
}
