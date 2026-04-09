/**
 * lib/timesheets/utils.ts — Pure date/period utility functions
 *
 * Safe for both client and server code. Zero side effects.
 */

/**
 * Returns the ISO week number for a given date.
 * ISO 8601: weeks start on Monday, week 1 contains Jan 4.
 */
export function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Returns the ISO week year (may differ from calendar year at boundaries).
 */
export function getISOWeekYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  return d.getUTCFullYear();
}

/**
 * Returns the Monday–Sunday date range for a given ISO week.
 * @returns { start: "YYYY-MM-DD", end: "YYYY-MM-DD" }
 */
export function getWeekRange(year: number, week: number): { start: string; end: string } {
  // Jan 4 is always in ISO week 1
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7; // Mon=1..Sun=7
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1 + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    start: fmtDate(monday),
    end: fmtDate(sunday),
  };
}

/**
 * Returns the first and last day of a month.
 * @param year  Full year, e.g. 2026
 * @param month 1-indexed month (1=January)
 */
export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0)); // day 0 of next month = last day
  return {
    start: fmtDate(first),
    end: fmtDate(last),
  };
}

/**
 * Generates an array of date strings between start and end (inclusive).
 */
export function dateRange(startStr: string, endStr: string): string[] {
  const dates: string[] = [];
  const cur = parseDate(startStr);
  const end = parseDate(endStr);
  while (cur <= end) {
    dates.push(fmtDate(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Creates a weekly period label like "2026-W15".
 */
export function weekLabel(date: Date): string {
  const year = getISOWeekYear(date);
  const week = getISOWeek(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/**
 * Creates a monthly period label like "2026-04".
 */
export function monthLabel(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Parses a "YYYY-MM-DD" string into a UTC Date.
 */
export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Formats a Date to "YYYY-MM-DD".
 */
export function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Parses a week label "YYYY-Www" into { year, week }.
 */
export function parseWeekLabel(label: string): { year: number; week: number } {
  const [yearStr, wStr] = label.split("-W");
  return { year: parseInt(yearStr, 10), week: parseInt(wStr, 10) };
}

/**
 * Parses a month label "YYYY-MM" into { year, month } (1-indexed).
 */
export function parseMonthLabel(label: string): { year: number; month: number } {
  const [y, m] = label.split("-").map(Number);
  return { year: y, month: m };
}

/**
 * Returns human-readable week display: "Apr 6 – Apr 12, 2026"
 */
export function formatWeekDisplay(start: string, end: string): string {
  const s = parseDate(start);
  const e = parseDate(end);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const sMonth = months[s.getUTCMonth()];
  const eMonth = months[e.getUTCMonth()];
  const sDay = s.getUTCDate();
  const eDay = e.getUTCDate();
  const eYear = e.getUTCFullYear();
  if (sMonth === eMonth) {
    return `${sMonth} ${sDay} – ${eDay}, ${eYear}`;
  }
  return `${sMonth} ${sDay} – ${eMonth} ${eDay}, ${eYear}`;
}

/**
 * Returns human-readable month display: "April 2026"
 */
export function formatMonthDisplay(label: string): string {
  const { year, month } = parseMonthLabel(label);
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${months[month - 1]} ${year}`;
}
