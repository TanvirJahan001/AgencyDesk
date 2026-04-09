/**
 * lib/api/validate.ts — Shared input validation helpers
 *
 * Provides reusable validation for API routes to prevent:
 *  - Oversized string payloads (DoS / storage abuse)
 *  - Negative financial amounts (logic manipulation)
 *  - Invalid email formats
 *  - Out-of-range numeric values
 */

// ── String validation ────────────────────────────────────────

/** Max lengths for common text fields (in characters) */
export const MAX_LENGTHS = {
  name:        200,
  email:       254,
  description: 2000,
  reason:      2000,
  note:        2000,
  content:     10000,
  title:       500,
  comment:     5000,
  address:     500,
  phone:       30,
} as const;

/**
 * Validate string length. Returns error message or null if valid.
 */
export function validateLength(
  value: string | undefined | null,
  fieldName: string,
  maxLength: number
): string | null {
  if (value && value.length > maxLength) {
    return `${fieldName} must be ${maxLength} characters or less.`;
  }
  return null;
}

// ── Number validation ────────────────────────────────────────

/**
 * Validate a monetary/financial value is non-negative.
 */
export function validateNonNegative(
  value: number | undefined | null,
  fieldName: string
): string | null {
  if (value != null && (typeof value !== "number" || value < 0)) {
    return `${fieldName} must be a non-negative number.`;
  }
  return null;
}

/**
 * Validate a number is within a range.
 */
export function validateRange(
  value: number | undefined | null,
  fieldName: string,
  min: number,
  max: number
): string | null {
  if (value != null) {
    if (typeof value !== "number" || value < min || value > max) {
      return `${fieldName} must be between ${min} and ${max}.`;
    }
  }
  return null;
}

// ── Email validation ─────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string | undefined | null): string | null {
  if (email && !EMAIL_REGEX.test(email)) {
    return "Invalid email format.";
  }
  return null;
}

// ── Batch validator ──────────────────────────────────────────

/**
 * Run multiple validations and return the first error, or null if all pass.
 */
export function firstError(...errors: (string | null)[]): string | null {
  return errors.find((e) => e !== null) ?? null;
}
