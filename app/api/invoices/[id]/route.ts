/**
 * app/api/invoices/[id]/route.ts
 *
 * GET — Retrieve a single invoice by ID
 *   - Admin/CEO: can retrieve any
 *   - Employee: can only retrieve own
 *
 * PATCH — Update invoice fields
 *   - Admin only
 *   - Body: { status?, tax?, discount?, notes?, lineItems?, paidAt? }
 *   - Recalculates subtotal/total if lineItems change
 *   - Sets paidAt if status changes to "paid"
 */

import { type NextRequest } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import {
  safeParseBody,
  ok,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api/helpers";
import { getInvoiceById, updateInvoice } from "@/lib/invoices/queries";
import { calcSubtotal, calcTotal } from "@/lib/invoices/utils";
import type { Invoice, InvoiceLineItem, InvoiceStatus } from "@/types";

const PRIVILEGED = new Set(["admin", "ceo"]);

// ─── GET: Retrieve single invoice ────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Auth
  const session = await getSession();
  if (!session) return unauthorized();

  // 2. Fetch invoice
  const { id: invoiceId } = await params;
  try {
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
      return notFound(`Invoice not found: ${invoiceId}`);
    }

    // 3. Check access
    if (!PRIVILEGED.has(session.role)) {
      // Employee can only see own
      if (invoice.userId !== session.uid) {
        return forbidden("You can only view your own invoices");
      }
    }

    return ok(invoice);
  } catch (err) {
    return serverError(err);
  }
}

// ─── PATCH: Update invoice ──────────────────────────────────

interface UpdateInvoiceBody {
  status?: InvoiceStatus;
  tax?: number;
  discount?: number;
  notes?: string | null;
  lineItems?: InvoiceLineItem[];
  paidAt?: string | null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Auth — admin only
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) return forbidden("Only admins can update invoices");

  const { id: invoiceId } = await params;

  // 2. Parse body
  const body = await safeParseBody<Record<string, unknown>>(req) as unknown as UpdateInvoiceBody;

  try {
    // 3. Fetch current invoice
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
      return notFound(`Invoice not found: ${invoiceId}`);
    }

    // 4. Build update object
    const updates: Partial<Invoice> = {
      updatedAt: new Date().toISOString(),
    };

    // Status
    if (body.status !== undefined) {
      updates.status = body.status;
      // If status changes to "paid", set paidAt
      if (body.status === "paid" && !invoice.paidAt) {
        updates.paidAt = body.paidAt ?? new Date().toISOString();
      }
    } else if (body.paidAt !== undefined) {
      updates.paidAt = body.paidAt;
    }

    // Direct fields
    if (body.tax !== undefined) updates.tax = body.tax;
    if (body.discount !== undefined) updates.discount = body.discount;
    if (body.notes !== undefined) updates.notes = body.notes;

    // Recalculate if lineItems change
    if (body.lineItems !== undefined) {
      updates.lineItems = body.lineItems;
      const newSubtotal = calcSubtotal(body.lineItems);
      updates.subtotal = newSubtotal;

      const newTax = updates.tax ?? invoice.tax;
      const newDiscount = updates.discount ?? invoice.discount;
      updates.total = calcTotal(newSubtotal, newTax, newDiscount);
    }

    // 5. Update in Firestore
    await updateInvoice(invoiceId, updates);

    // 6. Return updated invoice
    const updated = await getInvoiceById(invoiceId);
    return ok(updated);
  } catch (err) {
    return serverError(err);
  }
}
