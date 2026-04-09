/**
 * lib/invoices/queries.ts — Invoice Firestore Operations
 */

import { adminDb } from "@/lib/firebase/admin";
import type { Invoice, InvoiceLineItem, InvoiceBillingType, InvoiceStatus } from "@/types";

const COL = "invoices";

/** Generate a human-friendly invoice number: INV-YYYY-NNNN */
export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const snap = await adminDb
    .collection(COL)
    .where("invoiceNumber", ">=", `INV-${year}-`)
    .where("invoiceNumber", "<=", `INV-${year}-\uf8ff`)
    .orderBy("invoiceNumber", "desc")
    .limit(1)
    .get();

  let seq = 1;
  if (!snap.empty) {
    const last = snap.docs[0].data().invoiceNumber as string;
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

/** List invoices with optional filters */
export async function listInvoices(filters: {
  userId?: string;
  status?: InvoiceStatus;
  billingType?: InvoiceBillingType;
  periodLabel?: string;
}): Promise<Invoice[]> {
  let q: FirebaseFirestore.Query = adminDb.collection(COL);

  if (filters.userId) q = q.where("userId", "==", filters.userId);
  if (filters.status) q = q.where("status", "==", filters.status);
  if (filters.billingType) q = q.where("billingType", "==", filters.billingType);
  if (filters.periodLabel) q = q.where("periodLabel", "==", filters.periodLabel);

  q = q.orderBy("createdAt", "desc");
  const snap = await q.get();
  return snap.docs.map((d) => d.data() as Invoice);
}

/** Update invoice fields */
export async function updateInvoice(
  id: string,
  updates: Partial<Pick<Invoice, "status" | "tax" | "discount" | "notes" | "lineItems" | "subtotal" | "total" | "paidAt" | "updatedAt">>
): Promise<void> {
  await adminDb.collection(COL).doc(id).update(updates);
}

/** Check for duplicate invoice (same user + period + billingType) */
export async function findDuplicateInvoice(
  userId: string,
  periodLabel: string,
  billingType: InvoiceBillingType
): Promise<Invoice | null> {
  const snap = await adminDb
    .collection(COL)
    .where("userId", "==", userId)
    .where("periodLabel", "==", periodLabel)
    .where("billingType", "==", billingType)
    .where("status", "in", ["draft", "issued"])
    .limit(1)
    .get();

  return snap.empty ? null : (snap.docs[0].data() as Invoice);
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
