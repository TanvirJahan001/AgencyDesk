/**
 * app/api/invoices/summary/route.ts
 *
 * GET — Invoice summary statistics
 *   Admin/CEO only
 *   Returns: {
 *     totalInvoices: number,
 *     totalAmount: number,
 *     byStatus: { [status]: { count, amount } },
 *     byType: { [billingType]: { count, amount } }
 *   }
 */

import { type NextRequest } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { unauthorized, forbidden, serverError, ok } from "@/lib/api/helpers";
import { getInvoiceSummary } from "@/lib/invoices/queries";

export async function GET(req: NextRequest) {
  // 1. Auth — admin/CEO only
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) {
    return forbidden("Only admins and CEOs can view invoice summary");
  }

  try {
    // 2. Get summary
    const summary = await getInvoiceSummary();
    return ok(summary);
  } catch (err) {
    return serverError(err);
  }
}
