/**
 * lib/utils.ts
 *
 * Shared utility helpers used throughout the app.
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind class names safely, resolving conflicts.
 * Drop-in replacement for clsx() with Tailwind support.
 *
 * @example  cn("px-4 py-2", isActive && "bg-blue-500")
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formats a JavaScript Date (or ISO string) to a readable local date string.
 * e.g. "Apr 8, 2026"
 */
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year:  "numeric",
    month: "short",
    day:   "numeric",
  });
}

/**
 * Formats a JavaScript Date (or ISO string) to a time string.
 * e.g. "09:15 AM"
 */
export function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString("en-US", {
    hour:   "2-digit",
    minute: "2-digit",
  });
}

/**
 * Converts a number to a currency string.
 * e.g. 4500 → "$4,500.00"
 */
export function formatCurrency(
  amount: number,
  currency = "USD",
  locale   = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    style:    "currency",
    currency,
  }).format(amount);
}
