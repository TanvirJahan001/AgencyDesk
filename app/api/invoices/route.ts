/**
 * app/api/invoices/route.ts
 *
 * GET — List invoices with role-based access control
 *   Query params: userId, status, billingType, periodLabel
 *   - Admin/CEO: see all (or filtered)
 *   - Employee: see only own
 *
 * POST — Create/generate a new invoice
 *   Admin only
 *   Body: {
 *     userId, billingType, periodLabel, periodStart, periodEnd,
 *     projectId?, projectName?, lineItems?, tax?, discount?, notes?, force?
 *   }
 *   - Auto-calculates line items for hourly/weekly/bi-weekly/monthly
 *   - Checks for duplicates unless force=true
 *   - Creates notification for employee
 */

import { type NextRequest } from "next/server";
/** Generate a unique ID without external deps */
function uuidv4(): string {
  return `inv_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import {
  safeParseBody,
  ok,
  badRequest,
  unauthorized,
  forbidden,
  conflict,
  serverError,
} from "@/lib/api/helpers";
import {
  generateInvoiceNumber,
  createInvoice,
  listInvoices,
  findDuplicateInvoice,
} from "@/lib/invoices/queries";
import {
  calcSubtotal,
  calcTotal,
  buildHourlyLineItems,
  buildFixedPeriodLineItem,
} from "@/lib/invoices/utils";
import { buildNotification, createNotification } from "@/lib/notifications/queries";
import { getAllSessionsByRange } from "@/lib/attendance/queries";
import { validateNonNegative, firstError } from "@/lib/api/validate";
import type {
  Invoice,
  InvoiceBillingType,
  InvoiceLineItem,
  AppUser,
  AttendanceSessionV2,
} from "@/types";

const PRIVILEGED = new Set(["admin", "ceo"]);
const DEFAULT_HOURLY_RATE = 15;
const DEFAULT_OT_MULTIPLIER = 1.5;
const DEFAULT_OT_THRESHOLD_MIN = 2400; // 40 hours
const DEFAULT_CURRENCY = "USD";

// ─── GET: List invoices ──────────────────────────────────────

export async function GET(req: NextRequest) {
  // 1. Auth
  const session = await getSession();
  if (!session) return unauthorized();

  // 2. Parse query params
  const { searchParams } = req.nextUrl;
  const queryUserId = searchParams.get("userId");
  const queryStatus = searchParams.get("status");
  const queryBillingType = searchParams.get("billingType");
  const queryPeriodLabel = searchParams.get("periodLabel");

  try {
    // 3. Build filters based on role
    let userId: string | undefined;

    if (PRIVILEGED.has(session.role)) {
      // Admin/CEO can see all or filtered
      userId = queryUserId ?? undefined;
    } else {
      // Employee can only see own
      userId = session.uid;
    }

    const filters: Parameters<typeof listInvoices>[0] = {
      userId,
      status: queryStatus as any,
      billingType: queryBillingType as any,
      periodLabel: queryPeriodLabel ?? undefined,
    };

    const invoices = await listInvoices(filters);
    return ok(invoices);
  } catch (err) {
    return serverError(err);
  }
}

// ─── POST: Create/generate invoice ───────────────────────────

interface CreateInvoiceBody {
  userId: string;
  billingType: InvoiceBillingType;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  projectId?: string | null;
  projectName?: string | null;
  lineItems?: InvoiceLineItem[];
  tax?: number;
  discount?: number;
  notes?: string | null;
  force?: boolean;
}

export async function POST(req: NextRequest) {
  // 1. Auth — admin only
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) return forbidden("Only admins can create invoices");

  // 2. Parse body
  const body = await safeParseBody<Record<string, unknown>>(req) as unknown as CreateInvoiceBody;

  // 3. Validate required fields
  if (!body.userId || !body.billingType || !body.periodLabel || !body.periodStart || !body.periodEnd) {
    return badRequest(
      "Missing required fields: userId, billingType, periodLabel, periodStart, periodEnd"
    );
  }

  // Validate billingType
  const validTypes: InvoiceBillingType[] = [
    "hourly",
    "weekly",
    "bi-weekly",
    "monthly",
    "project-based",
  ];
  if (!validTypes.includes(body.billingType)) {
    return badRequest(`Invalid billingType: ${body.billingType}`);
  }

  // Input validation
  const validationError = firstError(
    body.tax != null ? validateNonNegative(body.tax, "tax") : null,
    body.discount != null ? validateNonNegative(body.discount, "discount") : null,
  );
  if (validationError) return badRequest(validationError);

  try {
    // 4. Check for duplicate unless force=true
    if (!body.force) {
      const existing = await findDuplicateInvoice(
        body.userId,
        body.periodLabel,
        body.billingType
      );
      if (existing) {
        return conflict(
          `Invoice already exists for this period: ${existing.invoiceNumber}`
        );
      }
    }

    // 5. Fetch employee details
    const empDoc = await adminDb.collection("users").doc(body.userId).get();
    if (!empDoc.exists) {
      return badRequest(`Employee not found: ${body.userId}`);
    }
    const employee = empDoc.data() as AppUser;

    // 6. Build line items
    let lineItems: InvoiceLineItem[] = body.lineItems ?? [];

    if (body.billingType === "hourly") {
      // Query attendance sessions for the user in the date range
      const sessions = await getAllSessionsByRange(
        body.periodStart,
        body.periodEnd,
        1000,
        "completed",
        body.userId
      );

      // Sum up total work minutes
      let totalWorkMinutes = 0;
      for (const session of sessions) {
        totalWorkMinutes += session.totalWorkMinutes ?? 0;
      }

      const hourlyRate = employee.hourlyRate ?? employee.salaryAmount ?? DEFAULT_HOURLY_RATE;
      const overtimeMultiplier = employee.overtimeMultiplier ?? DEFAULT_OT_MULTIPLIER;

      lineItems = buildHourlyLineItems(
        totalWorkMinutes,
        hourlyRate,
        overtimeMultiplier,
        DEFAULT_OT_THRESHOLD_MIN
      );
    } else if (
      body.billingType === "weekly" ||
      body.billingType === "bi-weekly" ||
      body.billingType === "monthly"
    ) {
      // Salary-based: single line item
      const salaryAmount = employee.salaryAmount ?? employee.hourlyRate ?? DEFAULT_HOURLY_RATE;
      lineItems = [buildFixedPeriodLineItem(body.billingType, salaryAmount, body.periodLabel)];
    } else if (body.billingType === "project-based") {
      // Must be provided in body
      if (!body.lineItems || body.lineItems.length === 0) {
        return badRequest("project-based invoices require lineItems in the body");
      }
      lineItems = body.lineItems;
    }

    // 7. Calculate amounts
    const subtotal = calcSubtotal(lineItems);
    const tax = body.tax ?? 0;
    const discount = body.discount ?? 0;
    const total = calcTotal(subtotal, tax, discount);

    // 8. Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();

    // 9. Create invoice document
    const invoiceId = `inv_${uuidv4()}`;
    const now = new Date().toISOString();

    const invoice: Invoice = {
      id: invoiceId,
      invoiceNumber,
      userId: body.userId,
      employeeName: employee.displayName ?? employee.email ?? body.userId,
      billingType: body.billingType,
      periodLabel: body.periodLabel,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      projectId: body.projectId ?? null,
      projectName: body.projectName ?? null,
      lineItems,
      subtotal,
      tax,
      discount,
      total,
      currency: DEFAULT_CURRENCY,
      status: "draft",
      notes: body.notes ?? null,
      generatedBy: session.uid,
      createdAt: now,
      updatedAt: now,
      paidAt: null,
    };

    await createInvoice(invoice);

    // 10. Create notification for employee
    const notif = buildNotification(
      body.userId,
      "invoice_generated",
      "New Invoice Generated",
      `Your invoice ${invoiceNumber} for ${body.periodLabel} has been generated. Amount: ${DEFAULT_CURRENCY} ${total.toFixed(2)}`,
      "/employee/invoices",
      invoiceId
    );
    await createNotification(notif);

    return ok(invoice);
  } catch (err) {
    return serverError(err);
  }
}
