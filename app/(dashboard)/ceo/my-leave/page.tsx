/**
 * app/(dashboard)/ceo/my-leave/page.tsx
 *
 * CEO's personal leave page — request leave, view balances & history.
 * Reuses EmployeeLeaveClient since the functionality is identical.
 */

import EmployeeLeaveClient from "@/app/(dashboard)/employee/leave/EmployeeLeaveClient";

export default function CEOMyLeavePage() {
  return <EmployeeLeaveClient />;
}
