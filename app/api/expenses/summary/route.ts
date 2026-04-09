/**
 * app/api/expenses/summary/route.ts
 *
 * GET — Admin/CEO only. Aggregate expense stats.
 *       Query: ?from=date&to=date&year=2026
 *       Returns: totalExpenses, byCategory, byMonth, byProject
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
import type { Expense } from "@/types";

// ── GET ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) return forbidden("Admin or CEO access required.");

  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const year = searchParams.get("year") ? parseInt(searchParams.get("year")!, 10) : new Date().getFullYear();

    // Get approved expenses only
    const snap = await adminDb
      .collection("expenses")
      .where("status", "==", "approved")
      .get();

    let expenses = snap.docs.map((d) => d.data() as Expense);

    // Filter by date range
    if (from || to) {
      expenses = expenses.filter((exp) => {
        if (from && exp.date < from) return false;
        if (to && exp.date > to) return false;
        return true;
      });
    }

    // Calculate summary stats
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Group by category
    const byCategory = Array.from(
      expenses.reduce((map, exp) => {
        const cat = exp.category;
        if (!map.has(cat)) {
          map.set(cat, { category: cat, total: 0, count: 0 });
        }
        const entry = map.get(cat)!;
        entry.total += exp.amount;
        entry.count += 1;
        return map;
      }, new Map<string, { category: string; total: number; count: number }>())
    ).map(([_, v]) => v);

    // Group by month
    const byMonth = Array.from(
      expenses.reduce((map, exp) => {
        const month = exp.date.substring(0, 7); // YYYY-MM
        if (!map.has(month)) {
          map.set(month, { month, total: 0 });
        }
        const entry = map.get(month)!;
        entry.total += exp.amount;
        return map;
      }, new Map<string, { month: string; total: number }>())
    ).map(([_, v]) => v).sort((a, b) => a.month.localeCompare(b.month));

    // Group by project
    const byProject = Array.from(
      expenses.reduce((map, exp) => {
        if (!exp.projectId) return map;
        const projId = exp.projectId;
        if (!map.has(projId)) {
          map.set(projId, { projectId: projId, projectName: exp.projectName || "Unknown", total: 0 });
        }
        const entry = map.get(projId)!;
        entry.total += exp.amount;
        return map;
      }, new Map<string, { projectId: string; projectName: string; total: number }>())
    ).map(([_, v]) => v).sort((a, b) => b.total - a.total);

    const summary = {
      totalExpenses,
      byCategory: byCategory.sort((a, b) => b.total - a.total),
      byMonth,
      byProject,
    };

    return ok(summary);
  } catch (err) {
    return serverError(err);
  }
}
