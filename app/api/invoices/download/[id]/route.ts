/**
 * app/api/invoices/download/[id]/route.ts
 *
 * GET — Download invoice as PDF
 *   - Admin/CEO: can download any
 *   - Employee: can only download own
 *   - Returns binary PDF with proper Content-Type and Content-Disposition headers
 */

import { type NextRequest, NextResponse } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import {
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api/helpers";
import { getInvoiceById } from "@/lib/invoices/queries";
import { generateInvoicePdf } from "@/lib/invoices/pdf-generator";

const PRIVILEGED = new Set(["admin", "ceo"]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Auth
  const session = await getSession();
  if (!session) return unauthorized();

  const { id: invoiceId } = await params;

  try {
    // 2. Fetch invoice
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
      return notFound(`Invoice not found: ${invoiceId}`);
    }

    // 3. Check access
    if (!PRIVILEGED.has(session.role)) {
      // Employee can only download own
      if (invoice.userId !== session.uid) {
        return forbidden("You can only download your own invoices");
      }
    }

    // 4. Generate PDF buffer
    const pdfBuffer = generateInvoicePdf(invoice);

    // 5. Return PDF with proper headers
    const filename = `${invoice.invoiceNumber}.pdf`;
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (err) {
    return serverError(err);
  }
}
