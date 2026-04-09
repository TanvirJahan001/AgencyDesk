/**
 * app/api/calendar/route.ts
 *
 * GET — Fetch calendar events for a date range.
 *
 * Query params:
 *   from  — start date YYYY-MM-DD (required)
 *   to    — end date YYYY-MM-DD (required)
 *
 * Returns array of calendar events aggregated from:
 *   - holidays (all users)
 *   - leave_requests (status=approved)
 *   - attendance_sessions (employee's own only for employees; all for admin/CEO)
 *
 * Success 200:
 *   { success: true, data: CalendarEvent[] }
 *
 * Error responses:
 *   401 — not authenticated
 *   400 — invalid date format or missing params
 *   500 — unexpected server error
 *
 * Access control:
 *   - Employees: show own attendance + approved leaves + holidays
 *   - Admins/CEOs: show all holidays + all approved leaves
 */

import { type NextRequest } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import { unauthorized, badRequest, serverError, ok } from "@/lib/api/helpers";

// ── Types ─────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;           // YYYY-MM-DD
  endDate?: string;       // YYYY-MM-DD (for multi-day events like leaves)
  type: "holiday" | "leave" | "attendance" | "deadline";
  color: string;          // hex color code
  meta?: Record<string, unknown>;
}

// ── Helpers ───────────────────────────────────────────────────

function isValidDate(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

// ── GET ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // 1. Authenticate
  const session = await getSession();
  if (!session) return unauthorized();

  // 2. Parse query params
  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return badRequest('Required query params: "from" and "to" (YYYY-MM-DD format)');
  }

  if (!isValidDate(from)) {
    return badRequest(`Invalid "from" date: "${from}". Expected YYYY-MM-DD.`);
  }

  if (!isValidDate(to)) {
    return badRequest(`Invalid "to" date: "${to}". Expected YYYY-MM-DD.`);
  }

  if (from > to) {
    return badRequest(`"from" date (${from}) must not be after "to" date (${to}).`);
  }

  try {
    const events: CalendarEvent[] = [];
    const isPrivileged = hasRole(session, "admin", "ceo");
    const userId = session.uid;

    // ─── Fetch Holidays (all users see all holidays) ───────────
    const holidaySnap = await adminDb
      .collection("holidays")
      .where("date", ">=", from)
      .where("date", "<=", to)
      .get();

    holidaySnap.docs.forEach((doc) => {
      const data = doc.data();
      events.push({
        id: doc.id,
        title: data.name || "Holiday",
        date: data.date,
        type: "holiday",
        color: "#dc2626", // red
        meta: { holidayType: data.type },
      });
    });

    // ─── Fetch Approved Leave Requests ──────────────────────────
    // Single .where() only — range filters on multiple fields require composite indexes.
    // Date range and employeeId filtering done in JS after fetch.
    const leaveSnap = await adminDb
      .collection("leave_requests")
      .where("status", "==", "approved")
      .limit(500)
      .get();

    leaveSnap.docs.forEach((doc) => {
      const data = doc.data();
      // JS-side date overlap check: leave overlaps [from, to] if startDate <= to && endDate >= from
      if (data.startDate > to || data.endDate < from) return;
      // JS-side employee filter for non-privileged users
      if (!isPrivileged && data.employeeId !== userId) return;
      events.push({
        id: doc.id,
        title: `${data.employeeName || "Leave"} (${data.type || "Leave"})`,
        date: data.startDate,
        endDate: data.endDate,
        type: "leave",
        color: "#ea580c", // orange
        meta: { leaveType: data.type, employeeId: data.employeeId },
      });
    });

    // ─── Fetch Attendance Sessions (employees: own only; admin/ceo: all) ───
    // Single .where() max — date range + employeeId filtering done in JS.
    let attendanceSnap: FirebaseFirestore.QuerySnapshot;
    if (!isPrivileged) {
      attendanceSnap = await adminDb
        .collection("attendance_sessions")
        .where("employeeId", "==", userId)
        .limit(500)
        .get();
    } else {
      attendanceSnap = await adminDb
        .collection("attendance_sessions")
        .limit(1000)
        .get();
    }

    attendanceSnap.docs.forEach((doc) => {
      const data = doc.data();
      // JS-side date range filter
      if ((data.date || "") < from || (data.date || "") > to) return;
      const status = data.status || "unknown";

      // Only show completed sessions as calendar events
      if (status === "completed" || status === "missed_checkout") {
        events.push({
          id: doc.id,
          title:
            status === "missed_checkout"
              ? `${data.employeeName || "Attendance"} (Missed Checkout)`
              : `${data.employeeName || "Attendance"} (Logged)`,
          date: data.date,
          type: "attendance",
          color: status === "missed_checkout" ? "#f97316" : "#16a34a", // orange for missed, green for logged
          meta: {
            employeeId: data.employeeId,
            status,
            totalWorkMs: data.totalWorkMs,
          },
        });
      }
    });

    return ok<CalendarEvent[]>(events);
  } catch (err) {
    return serverError(err);
  }
}
