"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  TrendingUp,
  Briefcase,
  DollarSign,
  Calendar,
  Clock,
  AlertCircle,
  FileText,
  Loader2,
} from "lucide-react";

interface AnalyticsData {
  employeeCount: number;
  departmentBreakdown: { department: string; count: number }[];
  attendanceRate: number;
  leaveRequestsThisMonth: number;
  pendingLeaves: number;
  expensesThisMonth: number;
  pendingExpenses: number;
  activeProjects: number;
  payrollThisMonth: number;
  recentHires: number;
  contractsExpiringSoon: number;
}

export default function AnalyticsDashboardClient() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics");
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        setError(json.error || "Failed to load analytics data");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Analytics Dashboard</h1>
        {/* Summary skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg border border-slate-200 bg-slate-100 p-6 h-24"
            />
          ))}
        </div>
        {/* Department skeleton */}
        <div className="animate-pulse rounded-lg border border-slate-200 bg-slate-100 p-6 h-64" />
        {/* Stats grid skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg border border-slate-200 bg-slate-100 p-6 h-20"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Analytics Dashboard</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Analytics Dashboard</h1>
        <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center text-sm text-slate-400">
          No data available
        </div>
      </div>
    );
  }

  const maxDeptCount = Math.max(...data.departmentBreakdown.map((d) => d.count), 1);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Analytics Dashboard</h1>

      {/* Summary Cards Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Employee Count */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Total Employees</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {data.employeeCount}
              </p>
            </div>
            <div className="rounded-lg bg-blue-100 p-3">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Attendance Rate */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Attendance Rate Today</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {data.attendanceRate}%
              </p>
            </div>
            <div className="rounded-lg bg-green-100 p-3">
              <Clock className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Active Projects */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Active Projects</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {data.activeProjects}
              </p>
            </div>
            <div className="rounded-lg bg-purple-100 p-3">
              <Briefcase className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Payroll This Month */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Payroll This Month</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                ${data.payrollThisMonth.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg bg-emerald-100 p-3">
              <DollarSign className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Department Breakdown */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-6 text-lg font-semibold text-slate-900">
          Department Breakdown
        </h2>
        <div className="space-y-4">
          {data.departmentBreakdown.length > 0 ? (
            data.departmentBreakdown.map((dept) => (
              <div key={dept.department} className="flex items-center gap-4">
                <div className="w-32 text-sm font-medium text-slate-700">
                  {dept.department}
                </div>
                <div className="flex-1">
                  <div className="relative h-6 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all"
                      style={{
                        width: `${(dept.count / maxDeptCount) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="w-12 text-right text-sm font-semibold text-slate-900">
                  {dept.count}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No department data available</p>
          )}
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Leave Requests This Month */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">
                Leave Requests (Month)
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {data.leaveRequestsThisMonth}
              </p>
            </div>
            <Calendar className="h-5 w-5 text-slate-400" />
          </div>
        </div>

        {/* Pending Leaves */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">
                Pending Leaves
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {data.pendingLeaves}
              </p>
            </div>
            <AlertCircle className="h-5 w-5 text-slate-400" />
          </div>
        </div>

        {/* Expenses This Month */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">
                Expenses (Month)
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                ${data.expensesThisMonth.toLocaleString()}
              </p>
            </div>
            <DollarSign className="h-5 w-5 text-slate-400" />
          </div>
        </div>

        {/* Pending Expenses */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">
                Pending Expenses
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                ${data.pendingExpenses.toLocaleString()}
              </p>
            </div>
            <AlertCircle className="h-5 w-5 text-slate-400" />
          </div>
        </div>

        {/* Recent Hires */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">
                Recent Hires (30d)
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {data.recentHires}
              </p>
            </div>
            <Users className="h-5 w-5 text-slate-400" />
          </div>
        </div>

        {/* Contracts Expiring Soon */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">
                Contracts Expiring (30d)
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {data.contractsExpiringSoon}
              </p>
            </div>
            <FileText className="h-5 w-5 text-slate-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
