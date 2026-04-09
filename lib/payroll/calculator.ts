/**
 * lib/payroll/calculator.ts — Payroll & Overtime Calculations
 *
 * Pure functions — no Firestore, no side effects, fully testable.
 * All inputs and outputs are in minutes (not hours or milliseconds).
 *
 * Overtime model:
 *   Daily threshold:  480 minutes (8 hours) — any work above this in a single day is OT
 *   Weekly threshold: 2400 minutes (40 hours) — any work above this in a week is OT
 *
 * The API routes and actions use these helpers exclusively for all pay math.
 */

// ─── Constants ────────────────────────────────────────────────

/** Regular work threshold per day: 8 hours = 480 minutes */
export const DAILY_REGULAR_THRESHOLD_MIN  = 480;

/** Regular work threshold per week: 40 hours = 2400 minutes */
export const WEEKLY_REGULAR_THRESHOLD_MIN = 2_400;

/** Default overtime multiplier (time-and-a-half) */
export const DEFAULT_OT_MULTIPLIER = 1.5;

// ─── Interfaces ───────────────────────────────────────────────

export interface PayrollInput {
  totalWorkMinutes:       number;
  hourlyRate:             number;
  overtimeMultiplier?:    number;   // default 1.5
  regularThresholdMin?:   number;   // minutes before OT kicks in (default 480)
}

export interface PayrollResult {
  regularMinutes:  number;
  overtimeMinutes: number;
  regularPay:      number;   // dollars
  overtimePay:     number;   // dollars
  grossPay:        number;   // dollars
}

export interface DayBreakdown {
  date:        string;   // YYYY-MM-DD
  workMinutes: number;
  regularMin:  number;
  overtimeMin: number;
  dailyPay:    number;   // gross for this day
}

export interface PeriodPayrollResult extends PayrollResult {
  totalDays:      number;
  dailyBreakdown: DayBreakdown[];
  periodLabel:    string;   // e.g. "Weekly" or "Monthly"
}

export interface WeeklyPayrollResult extends PeriodPayrollResult {
  weekStart:  string;
  weekEnd:    string;
}

export interface MonthlyPayrollResult extends PeriodPayrollResult {
  monthStart: string;
  monthEnd:   string;
}

// ─── Core helpers ─────────────────────────────────────────────

/**
 * Convert minutes to decimal hours, rounded to 2dp.
 * e.g. minutesToHours(90) → 1.5
 */
export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

/**
 * Calculate overtime minutes above the daily 8-hour threshold.
 * e.g. 510 minutes → 30 overtime minutes
 */
export function calculateOvertimeMinutes(
  totalWorkMinutes: number,
  thresholdMin = DAILY_REGULAR_THRESHOLD_MIN
): number {
  return Math.max(0, totalWorkMinutes - thresholdMin);
}

/**
 * Format a dollar amount as a string with 2 decimal places.
 * e.g. 1234.5 → "1234.50"
 */
export function formatPay(amount: number): string {
  return amount.toFixed(2);
}

// ─── Single-day payroll ───────────────────────────────────────

/**
 * Calculate payroll for a single work day.
 *
 * Uses a per-day threshold (default 8h = 480 min).
 * Any minutes above the threshold are billed at hourlyRate × overtimeMultiplier.
 *
 * @example
 * calculateDayPayroll({ totalWorkMinutes: 540, hourlyRate: 20 })
 * // 480 regular min → $160, 60 OT min @ 1.5x → $30, gross $190
 */
export function calculateDayPayroll(input: PayrollInput): PayrollResult {
  const {
    totalWorkMinutes,
    hourlyRate,
    overtimeMultiplier  = DEFAULT_OT_MULTIPLIER,
    regularThresholdMin = DAILY_REGULAR_THRESHOLD_MIN,
  } = input;

  const clampedMin    = Math.max(0, totalWorkMinutes);
  const regularMinutes  = Math.min(clampedMin, regularThresholdMin);
  const overtimeMinutes = Math.max(0, clampedMin - regularThresholdMin);

  const regularPay   = minutesToHours(regularMinutes)  * hourlyRate;
  const overtimePay  = minutesToHours(overtimeMinutes) * hourlyRate * overtimeMultiplier;
  const grossPay     = regularPay + overtimePay;

  return { regularMinutes, overtimeMinutes, regularPay, overtimePay, grossPay };
}

// ─── Period payroll (multiple days, daily OT) ─────────────────

/**
 * Calculate payroll for a period by summing daily overtime.
 * Each day is evaluated independently against the daily threshold.
 *
 * Use this for weekly or monthly summaries when you want:
 *   "Any day over 8h is overtime, regardless of the weekly total."
 *
 * Sessions with status other than "completed" are still included —
 * the caller is responsible for filtering.
 */
export function calculatePeriodPayroll(
  sessions: Array<{ totalWorkMinutes: number; workDate: string }>,
  hourlyRate: number,
  overtimeMultiplier = DEFAULT_OT_MULTIPLIER,
  label = "Period"
): PeriodPayrollResult {
  let regularMinutes  = 0;
  let overtimeMinutes = 0;
  let regularPay      = 0;
  let overtimePay     = 0;
  const dailyBreakdown: DayBreakdown[] = [];

  for (const s of sessions) {
    const day = calculateDayPayroll({
      totalWorkMinutes:   s.totalWorkMinutes,
      hourlyRate,
      overtimeMultiplier,
    });

    regularMinutes  += day.regularMinutes;
    overtimeMinutes += day.overtimeMinutes;
    regularPay      += day.regularPay;
    overtimePay     += day.overtimePay;

    dailyBreakdown.push({
      date:        s.workDate,
      workMinutes: s.totalWorkMinutes,
      regularMin:  day.regularMinutes,
      overtimeMin: day.overtimeMinutes,
      dailyPay:    day.grossPay,
    });
  }

  return {
    regularMinutes,
    overtimeMinutes,
    regularPay,
    overtimePay,
    grossPay:       regularPay + overtimePay,
    totalDays:      sessions.length,
    dailyBreakdown,
    periodLabel:    label,
  };
}

// ─── Weekly payroll (with weekly OT threshold option) ─────────

/**
 * Calculate weekly payroll with a weekly OT threshold.
 *
 * This is the US-style model: the first 40 hours each week are regular;
 * all hours beyond 40 are overtime, regardless of per-day totals.
 *
 * For the simpler daily-OT model, use calculatePeriodPayroll() instead.
 */
export function calculateWeeklyPayroll(
  sessions: Array<{ totalWorkMinutes: number; workDate: string }>,
  hourlyRate: number,
  overtimeMultiplier = DEFAULT_OT_MULTIPLIER,
  weeklyThresholdMin = WEEKLY_REGULAR_THRESHOLD_MIN
): WeeklyPayrollResult & { weekStart: string; weekEnd: string } {
  // Sort sessions chronologically so daily OT is applied in order
  const sorted = [...sessions].sort((a, b) =>
    a.workDate.localeCompare(b.workDate)
  );

  let totalMinutesAccrued = 0;
  let regularMinutes      = 0;
  let overtimeMinutes     = 0;
  let regularPay          = 0;
  let overtimePay         = 0;
  const dailyBreakdown: DayBreakdown[] = [];

  for (const s of sorted) {
    const workMin = Math.max(0, s.totalWorkMinutes);
    const remainingRegular = Math.max(0, weeklyThresholdMin - totalMinutesAccrued);

    const dayRegMin = Math.min(workMin, remainingRegular);
    const dayOtMin  = Math.max(0, workMin - remainingRegular);

    const dayRegPay  = minutesToHours(dayRegMin) * hourlyRate;
    const dayOtPay   = minutesToHours(dayOtMin)  * hourlyRate * overtimeMultiplier;
    const dayGross   = dayRegPay + dayOtPay;

    regularMinutes  += dayRegMin;
    overtimeMinutes += dayOtMin;
    regularPay      += dayRegPay;
    overtimePay     += dayOtPay;
    totalMinutesAccrued += workMin;

    dailyBreakdown.push({
      date:        s.workDate,
      workMinutes: workMin,
      regularMin:  dayRegMin,
      overtimeMin: dayOtMin,
      dailyPay:    dayGross,
    });
  }

  // Determine week range from sessions (or empty string if no sessions)
  const weekStart = sorted[0]?.workDate ?? "";
  const weekEnd   = sorted[sorted.length - 1]?.workDate ?? "";

  return {
    regularMinutes,
    overtimeMinutes,
    regularPay,
    overtimePay,
    grossPay:    regularPay + overtimePay,
    totalDays:   sessions.length,
    dailyBreakdown,
    periodLabel: "Weekly",
    weekStart,
    weekEnd,
  };
}

// ─── Deduction & net pay ──────────────────────────────────────

/**
 * Apply a flat deduction to gross pay and return net pay.
 * Returns 0 if deductions exceed gross.
 *
 * @example
 * applyDeductions(500, 50) → 450
 */
export function applyDeductions(grossPay: number, deductions: number): number {
  return Math.max(0, grossPay - deductions);
}

/**
 * Build a complete payroll summary including deductions and net pay.
 */
export function buildPayrollSummary(
  result: PayrollResult,
  deductions = 0
): PayrollResult & { deductions: number; netPay: number } {
  return {
    ...result,
    deductions,
    netPay: applyDeductions(result.grossPay, deductions),
  };
}
