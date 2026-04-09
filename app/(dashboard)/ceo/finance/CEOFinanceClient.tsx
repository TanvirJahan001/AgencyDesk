"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  Loader2,
} from "lucide-react";

interface MonthData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

interface TopClient {
  clientId: string;
  clientName: string;
  total: number;
}

interface DashboardStats {
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  outstandingInvoices: number;
  activeProjects: number;
  activeClients: number;
  teamUtilization: number;
  revenueByMonth: MonthData[];
  topClients: TopClient[];
}

export default function CEOFinanceClient() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/stats");
      const json = await res.json();
      if (json.success) {
        setStats(json.data);
      } else {
        setError(json.error || "Failed to load dashboard data");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
        {error}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center text-sm text-slate-400">
        No data available
      </div>
    );
  }

  const monthlyData = stats.revenueByMonth ?? [];
  const topClients = stats.topClients ?? [];

  const maxMonthValue = monthlyData.length > 0
    ? Math.max(...monthlyData.map((m) => Math.max(m.revenue, m.expenses)), 1)
    : 1;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Financial Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-600 uppercase">
              Total Revenue
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-green-600">
            ${(stats.totalRevenue ?? 0).toLocaleString()}
          </div>
          <p className="mt-2 text-xs text-slate-500">Overall revenue</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-600 uppercase">
              Total Expenses
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-red-600">
            ${(stats.totalExpenses ?? 0).toLocaleString()}
          </div>
          <p className="mt-2 text-xs text-slate-500">Total spent</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-600 uppercase">
              Net Profit
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <div
            className={`text-2xl font-bold ${
              (stats.profit ?? 0) >= 0 ? "text-blue-600" : "text-red-600"
            }`}
          >
            ${(stats.profit ?? 0).toLocaleString()}
          </div>
          <p className="mt-2 text-xs text-slate-500">Revenue minus expenses</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-600 uppercase">
              Outstanding
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100">
              <Receipt className="h-5 w-5 text-yellow-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-yellow-600">
            ${(stats.outstandingInvoices ?? 0).toLocaleString()}
          </div>
          <p className="mt-2 text-xs text-slate-500">Pending invoices</p>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-slate-900">{stats.activeProjects ?? 0}</p>
          <p className="text-xs text-slate-500">Active Projects</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-slate-900">{stats.activeClients ?? 0}</p>
          <p className="text-xs text-slate-500">Active Clients</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-slate-900">{stats.teamUtilization ?? 0}%</p>
          <p className="text-xs text-slate-500">Team Utilization</p>
        </div>
      </div>

      {/* Revenue vs Expenses Chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Revenue vs Expenses — Last 6 Months
        </h2>
        {monthlyData.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No monthly data yet</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <div className="flex gap-4 justify-around pb-4" style={{ minWidth: "100%" }}>
                {monthlyData.map((data) => (
                  <div key={data.month} className="flex flex-col items-center gap-2">
                    <div className="flex gap-1 items-end" style={{ height: "200px" }}>
                      <div
                        className="bg-green-500 rounded-t transition-all"
                        style={{
                          width: "20px",
                          height: `${Math.max((data.revenue / maxMonthValue) * 180, 2)}px`,
                        }}
                        title={`Revenue: $${data.revenue.toLocaleString()}`}
                      />
                      <div
                        className="bg-red-400 rounded-t transition-all"
                        style={{
                          width: "20px",
                          height: `${Math.max((data.expenses / maxMonthValue) * 180, 2)}px`,
                        }}
                        title={`Expenses: $${data.expenses.toLocaleString()}`}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-600">
                      {data.month}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 flex gap-4 justify-center">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-green-500" />
                <span className="text-xs text-slate-600">Revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-red-400" />
                <span className="text-xs text-slate-600">Expenses</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Top Clients */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Top Clients by Revenue
        </h2>
        {topClients.length === 0 ? (
          <p className="text-sm text-slate-500">No client revenue data yet. Generate paid invoices linked to projects to see data here.</p>
        ) : (
          <div className="space-y-3">
            {topClients.map((client, idx) => (
              <div key={client.clientId || idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                    {idx + 1}
                  </span>
                  <p className="font-medium text-slate-900">{client.clientName}</p>
                </div>
                <p className="font-semibold text-slate-900">
                  ${client.total.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
