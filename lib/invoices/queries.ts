/**
 * lib/invoices/queries.ts — Invoice Firestore Operations
 *
 * All queries use at most ONE .where() — sorting/filtering done in JS
 * to avoid composite index requirements.
 */

import { adminDb } from "@/lib/firebase/admin";
import type { Invoice, InvoiceLineItem, InvoiceBillingType, InvoiceStatus } from "@/types";

const COL = "invoices";

/** Generate a human-friendly invoice number: INV-YYYY-NNNN */
export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  // Plain fetch + JS-side filter/sort to avoid composite index on invoiceNumber range + orderBy.
  const snap = await adminDb
    .collection(COL)
    .limit(2000)
    .get();

  let seq = 1;
  const prefix = `INV-${year}-`;
  const yearInvoices = snap.docs
    .map((d) => d.data().invoiceNumber as string)
    .filter((n) => n && n.startsWith(prefix))
    .sort((a, b) => b.localeCompare(a));

  if (yearInvoices.length > 0) {
    const last = yearInvoices[0];
    const lastSeq = parseInt(last.split("-")[2], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  return `INV-${year}-${String(seq).padStart(4, "0")}`;
}

/** Create a new invoice */
export async function createInvoice(invoice: Invoice): Promise<void> {
  await adminDb.collection(COL).doc(invoice.id).set(invoice);
}

/** Get a single invoice by ID */
export async function getInvoiceById(id: string): Promise<Invoice | null> {
  const doc = await adminDb.collection(COL).doc(id).get();
  return doc.exists ? (doc.data() as Invoice) : null;
}

/** List invoices with optional filters.
 * Uses at most ONE .where() — rest filtered in JS. */
export async function listInvoices(filters: {
  userId?: string;
  status?: InvoiceStatus;
  billingType?: InvoiceBillingType;
  periodLabel?: string;
}): Promise<Invoice[]> {
  let snap;

  // Pick the most selective single filter
  if (filters.userId) {
    snap = await adminDb.collection(COL)
      .where("userId", "==", filters.userId)
      .limit(1000)
      .get();
  } else if (filters.status) {
    snap = await adminDb.collection(COL)
      .where("status", "==", filters.status)
      .limit(1000)
      .get();
  } else {
    snap = await adminDb.collection(COL).limit(1000).get();
  }

  let results = snap.docs.map((d) => d.data() as Invoice);

  // JS-side filters
  if (filters.userId) results = results.filter((i) => i.userId === filters.userId);
  if (filters.status) results = results.filter((i) => i.status === filters.status);
  if (filters.billingType) results = results.filter((i) => i.billingType === filters.billingType);
  if (filters.periodLabel) results = results.filter((i) => i.periodLabel === filters.periodLabel);

  results.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return results;
}

/** Update invoice fields */
export async function updateInvoice(
  id: string,
  updates: Partial<Pick<Invoice, "status" | "tax" | "discount" | "notes" | "lineItems" | "subtotal" | "total" | "paidAt" | "updatedAt">>
): Promise<void> {
  await adminDb.collection(COL).doc(id).update(updates);
}

/** Check for duplicate invoice (same user + period + billingType).
 * Single .where() + JS-side filter. */
export async function findDuplicateInvoice(
  userId: string,
  periodLabel: string,
  billingType: InvoiceBillingType
): Promise<Invoice | null> {
  const snap = await adminDb
    .collection(COL)
    .where("userId", "==", userId)
    .limit(200)
    .get();

  const match = snap.docs.find((d) => {
    const data = d.data();
    return (
      data.periodLabel === periodLabel &&
      data.billingType === billingType &&
      (data.status === "draft" || data.status === "issued")
    );
  });

  return match ? (match.data() as Invoice) : null;
}

/** Get invoice summary stats */
export async function getInvoiceSummary(): Promise<{
  totalInvoices: number;
  totalAmount: number;
  byStatus: Record<string, { count: number; amount: number }>;
  byType: Record<string, { count: number; amount: number }>;
}> {
  const snap = await adminDb.collection(COL).get();
  const invoices = snap.docs.map((d) => d.data() as Invoice);

  const byStatus: Record<string, { count: number; amount: number }> = {};
  const byType: Record<string, { count: number; amount: number }> = {};

  let totalAmount = 0;

  for (const inv of invoices) {
    totalAmount += inv.total;

    if (!byStatus[inv.status]) byStatus[inv.status] = { count: 0, amount: 0 };
    byStatus[inv.status].count++;
    byStatus[inv.status].amount += inv.total;

    if (!byType[inv.billingType]) byType[inv.billingType] = { count: 0, amount: 0 };
    byType[inv.billingType].count++;
    byType[inv.billingType].amount += inv.total;
  }

  return { totalInvoices: invoices.length, totalAmount, byStatus, byType };
}
