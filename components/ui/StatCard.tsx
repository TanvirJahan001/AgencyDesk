/**
 * components/ui/StatCard.tsx
 *
 * Reusable KPI card for dashboard overview pages.
 *
 * Usage:
 *   <StatCard
 *     title="Total Employees"
 *     value={48}
 *     icon={Users}
 *     iconColor="text-blue-600"
 *     iconBg="bg-blue-50"
 *   />
 */

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title:     string;
  value:     string | number;
  subtitle?: string;
  icon:      LucideIcon;
  iconColor: string;
  iconBg:    string;
  className?: string;
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  iconBg,
  className,
}: StatCardProps) {
  return (
    <div className={cn("card flex items-start gap-4", className)}>
      {/* Icon badge */}
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          iconBg
        )}
        aria-hidden="true"
      >
        <Icon className={cn("h-5 w-5", iconColor)} />
      </div>

      {/* Text */}
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{title}</p>
        <p className="mt-0.5 text-xl font-semibold text-slate-900 tabular-nums">
          {value}
        </p>
        {subtitle && (
          <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
