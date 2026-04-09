/**
 * lib/payroll/utils.ts — Pure Payroll Calculation Utilities
 *
 * Zero side effects. Safe for both client and server code.
 *
 * Key concepts:
 *  - All time is tracked in MINUTES for payroll (not ms like attendance)
 *  - Weekly overtime: any work minutes above the threshold in a week
 *    are billed at hourlyRate * overtimeMultiplier
 *  - Monthly payroll sums weekly OT across all weeks in the month
 */

import type { PayrollDayBreakdown } from "@/types";

// ── Defaults ─────────────────────────────────────────────────

/** Default hourly rate when employee has none configured ($0) */
export const DEFAULT_HOURLY_RATE = 0;

/** Standard overtime multiplier (time-and-a-half) */
export const DEFAULT_OT_MULTIPLIER = 1.5;

/** Standard weekly overtime threshold: 40 hours = 2400 minutes */
export const DEFAULT_WEEKLY_OT_THRESHOLD_MIN = 2400;

// ── Conversion helpers ───────────────────────────────────────

/** Milliseconds → minutes (rounded to 2 decimal places) */
export function msToMinutes(ms: number): number {
  return Math.round((ms / 60000) * 100) / 100;
}

/** Minutes → hours (rounded to 2 decimals) */
export function minToHours(min: number): number {
  return Math.round((min / 60) * 100) / 100;
}

/** Minutes → "HH:MM" display string */
export function minToHHMM(min: number): string {
  if (min < 0) min = 0;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Minutes → human-readable "Xh Ym" */
export function minToReadable(min: number): string {
  if (min < 0) min = 0;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m}m`;
}

// ── Weekly overtime calculation ──────────────────────────────

export interface WeeklyOTResult {
  regularMin:  number;
  overtimeMin: number;
}

/**
 * Splits total weekly work minutes into regular and overtime.
 *
 * @param weeklyWorkMin    Total work minutes in the week
 * @param thresholdMin     Weekly OT threshold (default 2400 = 40h)
 * @returns { regularMin, overtimeMin }
 */
export function calculateWeeklyOT(
  weeklyWorkMin: number,
  thresholdMin: number = DEFAULT_WEEKLY_OT_THRESHOLD_MIN
): WeeklyOTResult {
  if (weeklyWorkMin <= thresholdMin) {
    return { regularMin: weeklyWorkMin, overtimeMin: 0 };
  }
  return {
    regularMin: thresholdMin,
    overtimeMin: weeklyWorkMin - thresholdMin,
  };
}

// ── Pay calculation ──────────────────────────────────────────

export interface PayCalculationInput {
  totalWorkMin:       number;
  hourlyRate:         number;
  overtimeMultiplier: number;
  weeklyOtThresholdMin: number;
  /**
   * For monthly payroll, pass weekly minute totals so OT
   * is calculated per-week. For weekly payroll, this can
   * be a single-element array with the total.
   */
  weeklyMinutes: number[];
}

export interface PayCalculationResult {
  regularMin:  number;
  overtimeMin: number;
  regularPay:  number;
  overtimePay: number;
  grossPay:    number;
}

/**
 * Master payroll calculation: splits work into regular/OT
 * across weeks, then computes pay amounts.
 */
export function calculatePay(input: PayCalculationInput): PayCalculationResult {
  const {
    hourlyRate,
    overtimeMultiplier,
    weeklyOtThresholdMin,
    weeklyMinutes,
  } = input;

  let totalRegular = 0;
  let totalOvertime = 0;

  for (const weekMin of weeklyMinutes) {
    const { regularMin, overtimeMin } = calculateWeeklyOT(weekMin, weeklyOtThresholdMin);
    totalRegular += regularMin;
    totalOvertime += overtimeMin;
  }

  const regularPay  = round2((totalRegular / 60) * hourlyRate);
  const overtimePay = round2((totalOvertime / 60) * hourlyRate * overtimeMultiplier);
  const grossPay    = round2(regularPay + overtimePay);

  return {
    regularMin:  round2(totalRegular),
    overtimeMin: round2(totalOvertime),
    regularPay,
    overtimePay,
    grossPay,
  };
}

// ── Week grouping (for monthly payroll) ──────────────────────

/**
 * Groups daily breakdowns into ISO weeks and returns
 * an array of per-week total work minutes.
 *
 * Used to correctly calculate per-week OT in a monthly payroll.
 */
export function groupDaysByWeek(days: PayrollDayBreakdown[]): number[] {
  const weekMap = new Map<string, number>();

  for (const day of days) {
    const wk = isoWeekKey(day.date);
    weekMap.set(wk, (weekMap.get(wk) || 0) + day.workMin);
  }

  return Array.from(weekMap.values());
}

/**
 * Returns "YYYY-Www" key for a date string.
 */
function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const dayOfWeek = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

// ── Formatting helpers ───────────────────────────────────────

/** Rounds to 2 decimal places (financial rounding) */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Formats a dollar amount: "$1,234.56"
 */
export function fmtCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats a rate: "$25.00/hr"
 */
export function fmtRate(hourlyRate: number): string {
  return `${fmtCurrency(hourlyRate)}/hr`;
}

/**
 * Returns a compact payroll summary line.
 * e.g. "40h reg + 5h OT = $1,187.50"
 */
export function payrollSummaryLine(result: PayCalculationResult): string {
  const regH = minToHours(result.regularMin);
  const otH  = minToHours(result.overtimeMin);
  return `${regH}h reg + ${otH}h OT = ${fmtCurrency(result.grossPay)}`;
}
