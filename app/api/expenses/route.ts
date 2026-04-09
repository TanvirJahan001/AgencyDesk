/**
 * app/api/expenses/route.ts
 *
 * GET   — List expenses. Admin/CEO see all. Employees see own.
 *         Query: ?projectId=x&category=software&status=pending&from=date&to=date
 * POST  — Create expense. Any authenticated user.
 *         Required: category, description, amount, date.
 *         Optional: projectId (looks up projectName/clientId).
 */

import { NextRequest } from "next/server";
import type { firestore } from "firebase-admin";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import {
  safeParseBody,
  unauthorized,
  badRequest,
  serverError,
  ok,
} from "@/lib/api/helpers";
import { sendNotificationToMany, getAdminAndCeoIds } from "@/lib/notifications/send";
import { validateLength, validateNonNegative, validateRange, firstError, MAX_LENGTHS } from "@/lib/api/validate";
import type { Expense, Project } from "@/types";

// ── GET ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    let query: firestore.Query = adminDb.collection("expenses");

    // Admin/CEO see all. Employees see only their own.
    if (!hasRole(session, "admin", "ceo")) {
      query = query.where("submittedBy", "==", session.uid);
    }

    // No additional .where() after the first — avoids composite index requirement.
    // projectId / category / status / date filters applied in JS after fetch.
    const snap = await query.limit(500).get();
    let expenses = snap.docs.map((d) => d.data() as Expense);

    // JS-side filters
    if (projectId) expenses = expenses.filter((e) => e.projectId === projectId);
    if (category)  expenses = expenses.filter((e) => e.category  === category);
    if (status)    expenses = expenses.filter((e) => e.status    === status);

    // Sort by date descending
    expenses.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    // Filter by date range if provided
    if (from || to) {
      expenses = expenses.filter((exp) => {
        if (from && exp.date < from) return false;
        if (to && exp.date > to) return false;
        return true;
      });
    }

    return ok(expenses);
  } catch (err) {
    return serverError(err);
  }
}

// ── POST ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await safeParseBody<{
    category?: string;
    description?: string;
    amount?: number;
    date?: string;
    projectId?: string | null;
    currency?: string;
  }>(req);

  const { category, description, amount, date, projectId, currency } = body;

  if (!category?.trim()) return badRequest("category is required.");
  if (!description?.trim()) return badRequest("description is required.");
  if (typeof amount !== "number" || amount <= 0) {
    return badRequest("amount must be a positive number.");
  }
  if (!date?.trim()) return badRequest("date is required.");

  // Validate date format
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    return badRequest("Invalid date format. Use YYYY-MM-DD.");
  }

  // Input validation
  const validationError = firstError(
    validateLength(description, "Description", MAX_LENGTHS.description),
    validateNonNegative(amount, "Amount"),
    validateRange(amount, "Amount", 0, 10000000),
  );
  if (validationError) return badRequest(validationError);

  try {
    let projectName: string | null = null;
    let clientId: string | null = null;

    // If projectId provided, look up project details
    if (projectId) {
      const projDoc = await adminDb.collection("projects").doc(projectId).get();
      if (projDoc.exists) {
        const proj = projDoc.data() as Project;
        projectName = proj.name;
        clientId = proj.clientId;
      }
    }

    // Get submitter name
    const userDoc = await adminDb.collection("users").doc(session.uid).get();
    const submitterName = userDoc.data()?.displayName || session.name || "Unknown";

    const expenseId = adminDb.collection("expenses").doc().id;
    const expense: Expense = {
      id: expenseId,
      projectId: projectId || null,
      projectName,
      clientId,
      category: category as Expense["category"],
      description,
      amount,
      currency: currency || "USD",
      date,
      status: "pending",
      submittedBy: session.uid,
      submitterName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await adminDb.collection("expenses").doc(expenseId).set(expense);

    // Notify all admins/CEOs of new expense
    try {
      const adminIds = await getAdminAndCeoIds();
      await sendNotificationToMany(adminIds, {
        type: "expense_submitted",
        title: "New Expense Submitted",
        message: `${submitterName} submitted a $${amount} expense for ${category}`,
        linkTo: "/admin/expenses",
        relatedId: expenseId,
      });
    } catch {
      // Silent fail - notification should not break the operation
    }

    return ok(expense);
  } catch (err) {
    return serverError(err);
  }
}
