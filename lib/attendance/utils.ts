/**
 * lib/attendance/utils.ts — Pure Utility Functions
 *
 * No Firestore calls. All pure functions for formatting and calculations.
 * Includes both legacy (ms-based) and new (minutes-based) functions.
 */

/**
 * Convert total minutes to HH:MM:SS timer string (NEW)
 * Optionally add extra elapsed seconds (for live ticking).
 * e.g., minutesToHMS(90, 45) → "01:30:45"
 */
export function minutesToHMS(totalMinutes: number, extraSeconds = 0): string {
  const totalSeconds = Math.floor(totalMinutes * 60) + extraSeconds;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Convert minutes to readable format (NEW)
 * e.g., 90 → "1h 30m", 45 → "45m", 125 → "2h 5m"
 */
export function minutesToReadable(min: number): string {
  if (min < 0) return "0m";
  
  const hours = Math.floor(min / 60);
  const minutes = min % 60;
  
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  
  return `${hours}h ${minutes}m`;
}

/**
 * Convert minutes to decimal hours (NEW)
 * e.g., 90 → "1.50", 480 → "8.00"
 */
export function minutesToDecimal(min: number): string {
  const hours = min / 60;
  return hours.toFixed(2);
}

/**
 * Format ISO 8601 timestamp to readable time (NEW)
 * Default: { hour: "2-digit", minute: "2-digit" }
 */
export function formatISO(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  try {
    const date = new Date(iso);
    const defaultOpts: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
    };
    const options = opts ?? defaultOpts;
    return date.toLocaleString("en-US", options);
  } catch {
    return iso;
  }
}

/**
 * Legacy functions (maintain backward compatibility)
 */

/**
 * Convert milliseconds to readable format (LEGACY)
 * e.g., 90000 → "1m 30s"
 */
export function msToReadable(ms: number): string {
  if (ms < 0) return "0s";

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours === 0 && minutes === 0) return `${seconds}s`;
  if (hours === 0) return `${minutes}m ${seconds}s`;
  return `${hours}h ${minutes}m`;
}

/**
 * Convert milliseconds to HH:MM:SS format (LEGACY)
 */
export function msToHMS(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Convert milliseconds to decimal hours (LEGACY)
 */
export function msToDecimalHours(ms: number): string {
  const hours = ms / (1000 * 60 * 60);
  return hours.toFixed(2);
}

/**
 * Convert milliseconds to total minutes (LEGACY)
 */
export function msTotalMinutes(ms: number): number {
  return Math.floor(ms / (1000 * 60));
}

/**
 * Legacy compatibility exports (for old route.ts)
 */

export function nowISO(): string {
  return new Date().toISOString();
}

export function todayDateStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isSessionExpired(startTime: string): boolean {
  const now = Date.now();
  const start = new Date(startTime).getTime();
  const hoursElapsed = (now - start) / (1000 * 60 * 60);
  return hoursElapsed > 16;
}

/**
 * Hook helper: compute live totals (LEGACY - for useAttendance hook)
 * Returns live work/break times with current elapsed segment included
 * @param totalWorkMs - accumulated work time in ms
 * @param totalBreakMs - accumulated break time in ms
 * @param currentSegmentType - type of current open segment ("work" or "break"), null if none
 * @param segmentStartTime - ISO timestamp when current segment started, null if none
 */
export function computeLiveTotals(
  totalWorkMs: number,
  totalBreakMs: number,
  currentSegmentType: string | null,
  segmentStartTime: string | null
): { liveWorkMs: number; liveBreakMs: number } {
  let liveWorkMs = totalWorkMs;
  let liveBreakMs = totalBreakMs;

  if (currentSegmentType && segmentStartTime) {
    const elapsedMs = elapsedSince(segmentStartTime);
    if (currentSegmentType === "work") {
      liveWorkMs += elapsedMs;
    } else if (currentSegmentType === "break") {
      liveBreakMs += elapsedMs;
    }
  }

  return { liveWorkMs, liveBreakMs };
}

/**
 * Hook helper: compute elapsed time since segment start (LEGACY - for useAttendance hook)
 */
export function elapsedSince(startTimeISO: string): number {
  const now = Date.now();
  const start = new Date(startTimeISO).getTime();
  return Math.max(0, now - start);
}
