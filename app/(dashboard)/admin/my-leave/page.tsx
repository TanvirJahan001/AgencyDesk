/**
 * app/(dashboard)/admin/my-leave/page.tsx
 *
 * Admin's personal leave page — request leave, view balances & history.
 * Reuses EmployeeLeaveClient since the functionality is identical.
 */

import EmployeeLeaveClient from "@/app/(dashboard)/employee/leave/EmployeeLeaveClient";

export default function AdminMyLeavePage() {
  return <EmployeeLeaveClient />;
}
