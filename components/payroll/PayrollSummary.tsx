/**
 * components/payroll/PayrollSummary.tsx — Payroll Summary Display
 *
 * Fetches from /api/payroll/weekly or /api/payroll/monthly and renders
 * a 4-stat grid: Total Hours, Regular Pay, Overtime Pay, Gross Pay.
 */

"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { minutesToReadable, minutesToDecimal } from "@/lib/attendance/utils";

interface PayrollSummaryProps {
  userId: string;
  period: "weekly" | "monthly";
}

interface PayrollData {
  regularMinutes:  number;
  overtimeMinutes: number;
  regularPay:      number;
  overtimePay:     number;
  grossPay:        number;
}

export default function PayrollSummary({ userId, period }: PayrollSummaryProps) {
  const [payroll, setPayroll] = useState<PayrollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const endpoint = period === "weekly"
          ? `/api/payroll/weekly?userId=${userId}`
          : `/api/payroll/monthly?userId=${userId}`;

        const res  = await fetch(endpoint);
        const json = await res.json();

        if (!res.ok || !json.success) {
          setError(json.error ?? "No payroll data available.");
          return;
        }

        // API returns: { success: true, data: { regularMinutes, overtimeMinutes, … } }
        const d = json.data;
        setPayroll({
          regularMinutes:  d.regularMinutes  ?? 0,
          overtimeMinutes: d.overtimeMinutes ?? 0,
          regularPay:      d.regularPay      ?? 0,
          overtimePay:     d.overtimePay     ?? 0,
          grossPay:        d.grossPay        ?? 0,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load payroll.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [userId, period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-700">{error}</div>
    );
  }

  if (!payroll) {
    return (
      <div className="text-center text-sm text-slate-500">No payroll data available.</div>
    );
  }

  const totalMinutes = payroll.regularMinutes + payroll.overtimeMinutes;

  return (
    <div className="rounded-lg border border-slate-200 p-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-xs font-medium text-slate-600">Total Hours</p>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {minutesToDecimal(totalMinutes)}
          </p>
          <p className="mt-1 text-xs text-slate-500">{minutesToReadable(totalMinutes)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-600">Regular Pay</p>
          <p className="mt-2 text-xl font-bold text-blue-600">
            ${payroll.regularPay.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {minutesToDecimal(payroll.regularMinutes)}h
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-600">Overtime Pay</p>
          <p className="mt-2 text-xl font-bold text-orange-600">
            ${payroll.overtimePay.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {minutesToDecimal(payroll.overtimeMinutes)}h
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-600">Gross Pay</p>
          <p className="mt-2 text-xl font-bold text-green-600">
            ${payroll.grossPay.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Total</p>
        </div>
      </div>
    </div>
  );
}
