/**
 * components/notifications/MissedCheckoutWarning.tsx
 *
 * Employee dashboard banner showing any missed checkouts
 * that need attention. Links to attendance history.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import type { AppNotification } from "@/types";

export default function MissedCheckoutWarning() {
  const [missedCount, setMissedCount] = useState(0);

  useEffect(() => {
    fetch("/api/notifications?limit=50")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          const notifs = json.data.notifications as AppNotification[];
          const missed = notifs.filter(
            (n) => n.type === "missed_checkout" && !n.read
          );
          setMissedCount(missed.length);
        }
      })
      .catch(() => {});
  }, []);

  if (missedCount === 0) return null;

  return (
    <Link
      href="/employee/attendance"
      className="flex items-center gap-3 rounded-lg bg-red-50 p-4 ring-1 ring-red-200 hover:bg-red-100 transition-colors"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-200">
        <AlertTriangle className="h-4 w-4 text-red-800" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-red-800">
          {missedCount} Missed Checkout{missedCount !== 1 ? "s" : ""}
        </p>
        <p className="text-xs text-red-600">
          Your session was auto-closed. Contact your admin if you need an adjustment.
        </p>
      </div>
      <ArrowRight className="h-4 w-4 text-red-600" />
    </Link>
  );
}
