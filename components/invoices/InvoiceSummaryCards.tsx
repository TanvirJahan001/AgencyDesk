"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import { FileText, DollarSign, CheckCircle2, AlertCircle, Clock } from "lucide-react";

interface SummaryData {
  totalInvoices: number;
  totalAmount: number;
  byStatus: Record<string, { count: number; amount: number }>;
  byType: Record<string, { count: number; amount: number }>;
}

export default function InvoiceSummaryCards() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSummary() {
      try {
        const res = await fetch("/api/invoices/summary");
        const json = await res.json();

        if (!json.success) {
          setError(json.error || "Failed to load summary");
          return;
        }

        setData(json.data);
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchSummary();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const fmt = (n: number) =>
    `$${(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  const paidAmount = data.byStatus?.paid?.amount ?? 0;
  const issuedAmount = data.byStatus?.issued?.amount ?? 0;
  const draftCount = data.byStatus?.draft?.count ?? 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <StatCard
        title="Total Invoices"
        value={data.totalInvoices ?? 0}
        icon={FileText}
        iconColor="text-blue-600"
        iconBg="bg-blue-50"
      />
      <StatCard
        title="Total Amount"
        value={fmt(data.totalAmount)}
        icon={DollarSign}
        iconColor="text-slate-600"
        iconBg="bg-slate-50"
      />
      <StatCard
        title="Paid Amount"
        value={fmt(paidAmount)}
        icon={CheckCircle2}
        iconColor="text-green-600"
        iconBg="bg-green-50"
      />
      <StatCard
        title="Outstanding"
        value={fmt(issuedAmount)}
        icon={AlertCircle}
        iconColor="text-orange-600"
        iconBg="bg-orange-50"
      />
      <StatCard
        title="Draft Invoices"
        value={draftCount}
        icon={Clock}
        iconColor="text-slate-600"
        iconBg="bg-slate-50"
      />
    </div>
  );
}
