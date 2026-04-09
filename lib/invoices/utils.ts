/**
 * lib/invoices/utils.ts — Invoice Calculation Helpers
 */

import type { InvoiceLineItem } from "@/types";

/** Calculate line item amount */
export function calcLineItemAmount(qty: number, rate: number): number {
  return Math.round(qty * rate * 100) / 100;
}

/** Calculate subtotal from line items */
export function calcSubtotal(items: InvoiceLineItem[]): number {
  return Math.round(items.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
}

/** Calculate total: subtotal + tax - discount */
export function calcTotal(subtotal: number, tax: number, discount: number): number {
  return Math.round((subtotal + tax - discount) * 100) / 100;
}

/** Build line items for hourly billing from work data */
export function buildHourlyLineItems(
  totalWorkMinutes: number,
  hourlyRate: number,
  overtimeMinutes: number,
  overtimeMultiplier: number
): InvoiceLineItem[] {
  const items: InvoiceLineItem[] = [];
  const regularMin = totalWorkMinutes - overtimeMinutes;

  if (regularMin > 0) {
    const regularHours = Math.round((regularMin / 60) * 100) / 100;
    items.push({
      description: "Regular work hours",
      quantity: regularHours,
      unitRate: hourlyRate,
      amount: calcLineItemAmount(regularHours, hourlyRate),
    });
  }

  if (overtimeMinutes > 0) {
    const otHours = Math.round((overtimeMinutes / 60) * 100) / 100;
    const otRate = Math.round(hourlyRate * overtimeMultiplier * 100) / 100;
    items.push({
      description: "Overtime hours",
      quantity: otHours,
      unitRate: otRate,
      amount: calcLineItemAmount(otHours, otRate),
    });
  }

  return items;
}

/** Build line items for a fixed-period billing type */
export function buildFixedPeriodLineItem(
  billingType: string,
  salaryAmount: number,
  periodLabel: string
): InvoiceLineItem {
  const typeLabel = billingType.charAt(0).toUpperCase() + billingType.slice(1);
  return {
    description: `${typeLabel} salary — ${periodLabel}`,
    quantity: 1,
    unitRate: salaryAmount,
    amount: salaryAmount,
  };
}

/** Format currency for display */
export function fmtCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}
