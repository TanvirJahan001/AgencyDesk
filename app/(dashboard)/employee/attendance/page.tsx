/**
 * app/(dashboard)/employee/attendance/page.tsx
 *
 * Employee — personal attendance history + correction requests.
 *
 * Sections:
 *   1. Completed sessions table with "Request Correction" action
 *   2. My Correction Requests list (pending/approved/rejected)
 */

import type { Metadata } from "next";
import EmployeeAttendanceClient from "./EmployeeAttendanceClient";

export const metadata: Metadata = { title: "My Attendance" };

export default function EmployeeAttendancePage() {
  return <EmployeeAttendanceClient />;
}
