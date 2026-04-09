/**
 * components/corrections/PendingCorrectionsBadge.tsx
 *
 * Small inline widget for the employee dashboard showing how many
 * correction requests are pending. Links to the full attendance page.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { CorrectionRequest } from "@/types";
import { Clock, ArrowRight } from "lucide-react";

export default function PendingCorrectionsBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetch("/api/attendance/corrections?status=pending")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setCount((json.data.corrections as CorrectionRequest[]).length);
        }
      })
      .catch(() => {});
  }, []);

  if (count === 0) return null;

  return (
    <Link
      href="/employee/attendance"
      className="flex items-center gap-3 rounded-lg bg-yellow-50 p-4 ring-1 ring-yellow-200 hover:bg-yellow-100 transition-colors"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-200">
        <Clock className="h-4 w-4 text-yellow-800" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-yellow-800">
          {count} Pending Correction{count !== 1 ? "s" : ""}
        </p>
        <p className="text-xs text-yellow-600">
          Awaiting admin review
        </p>
      </div>
      <ArrowRight className="h-4 w-4 text-yellow-600" />
    </Link>
  );
}
