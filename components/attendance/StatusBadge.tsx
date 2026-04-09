/**
 * components/attendance/StatusBadge.tsx — Status Display Badge
 *
 * Shows the current status with color coding.
 */

import { cn } from "@/lib/utils";
import type { SessionStatusV2 } from "@/types";

interface StatusBadgeProps {
  status: SessionStatusV2 | "idle";
  className?: string;
}

const STATUS_CONFIG = {
  idle: {
    label: "Not Started",
    bg: "bg-slate-100",
    text: "text-slate-700",
  },
  working: {
    label: "Working",
    bg: "bg-green-100",
    text: "text-green-700",
  },
  on_break: {
    label: "On Break",
    bg: "bg-yellow-100",
    text: "text-yellow-700",
  },
  completed: {
    label: "Completed",
    bg: "bg-blue-100",
    text: "text-blue-700",
  },
  missed_checkout: {
    label: "Missed Checkout",
    bg: "bg-red-100",
    text: "text-red-700",
  },
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        "inline-block rounded-full px-3 py-1 text-sm font-medium",
        config.bg,
        config.text,
        className
      )}
    >
      {config.label}
    </span>
  );
}
