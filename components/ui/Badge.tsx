/**
 * components/ui/Badge.tsx
 *
 * Status badge for attendance and payroll statuses.
 *
 * Usage:
 *   <Badge status="present" />
 *   <Badge status="paid" />
 */

import { cn } from "@/lib/utils";
import type { AttendanceStatus, PayrollStatus } from "@/types";

type BadgeStatus = AttendanceStatus | PayrollStatus;

const STATUS_MAP: Record<BadgeStatus, { label: string; cls: string }> = {
  // Attendance
  present:  { label: "Present",  cls: "badge-green"  },
  absent:   { label: "Absent",   cls: "badge-red"    },
  late:     { label: "Late",     cls: "badge-yellow" },
  "half-day":{ label: "Half Day", cls: "badge-yellow" },
  holiday:  { label: "Holiday",  cls: "badge-blue"   },
  // Payroll
  draft:    { label: "Draft",    cls: "badge-yellow" },
  processed:{ label: "Processed",cls: "badge-blue"   },
  paid:     { label: "Paid",     cls: "badge-green"  },
};

interface BadgeProps {
  status:    BadgeStatus;
  className?: string;
}

export default function Badge({ status, className }: BadgeProps) {
  const { label, cls } = STATUS_MAP[status] ?? { label: status, cls: "badge-gray" };
  return <span className={cn(cls, className)}>{label}</span>;
}
