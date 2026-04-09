"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign,
  Plus,
  Check,
  X,
  Loader2,
  Receipt,
  Filter,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Expense {
  id: string;
  date: string;
  description: string;
  category: string;
  project?: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  submittedBy: string;
  notes?: string;
}

interface SummaryStats {
  totalExpenses: number;
  byCategory: { category: string; total: number; count: number }[];
  byMonth: { month: string; total: number }[];
  byProject: { projectId: string; projectName: string; total: number }[];
}

const EXPENSE_CATEGORIES = [
  "Travel",
  "Meals",
  "Accommodation",
  "Equipment",
  "Software",
  "Office Supplies",
  "Training",
  "Client Reimbursement",
  "Other",
];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const CATEGORY_COLORS: Record<string, string> = {
  Travel: "bg-blue-100 text-blue-800",
  Meals: "bg-orange-100 text-orange-800",
  Accommodation: "bg-purple-100 text-purple-800",
  Equipment: "bg-slate-100 text-slate-800",
  Software: "bg-cyan-100 text-cyan-800",
  Training: "bg-indigo-100 text-indigo-800",
  "Client Reimbursement": "bg-emerald-100 text-emerald-800",
  Other: "bg-slate-100 text-slate-700",
};

export default function AdminExpensesClient() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [dateStart, setDateStart] = useState<string>("");
  const [dateEnd, setDateEnd] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    category: "",
    description: "",
    amount: "",
    date: "",
    project: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<"approved" | "rejected" | null>(null);
  const [processing, setProcessing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [expRes, sumRes] = await Promise.all([
        fetch("/api/expenses"),
        fetch("/api/expenses/summary?year=2026"),
      ]);
      const expJson = await expRes.json();
      const sumJson = await sumRes.json();

      if (expJson.success) setExpenses(expJson.data || []);
      if (sumJson.success) setSummary(sumJson.data);
    } catch (err) {
      setError("Failed to load expense data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredExpenses = expenses.filter((exp) => {
    const categoryMatch = !categoryFilter || exp.category === categoryFilter;
    const statusMatch = !statusFilter || exp.status === statusFilter;
    const projectMatch = !projectFilter || exp.project === projectFilter;

    let dateMatch = true;
    if (dateStart) dateMatch = new Date(exp.date) >= new Date(dateStart);
    if (dateEnd) dateMatch = dateMatch && new Date(exp.date) <= new Date(dateEnd);

    return categoryMatch && statusMatch && projectMatch && dateMatch;
  });

  const projects = Array.from(
    new Set(expenses.map((e) => e.project).filter((p) => p))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.category || !form.description || !form.amount || !form.date) {
      setError("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: form.category,
          description: form.description.trim(),
          amount: parseFloat(form.amount),
          date: form.date,
          project: form.project || undefined,
          notes: form.notes || undefined,
        }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.error || "Failed to add expense");
        return;
      }

      setSuccess("Expense added successfully");
      setForm({
        category: "",
        description: "",
        amount: "",
        date: "",
        project: "",
        notes: "",
      });
      setModalOpen(false);
      await fetchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleAction = (id: string, status: "approved" | "rejected") => {
    setActionStatus(status);
    setActionId(id);
  };

  const confirmAction = async () => {
    if (!actionId || !actionStatus) return;

    setProcessing(true);
    try {
      const res = await fetch(`/api/expenses/${actionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: actionStatus }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.error || "Failed to update expense");
        return;
      }

      setSuccess(`Expense ${actionStatus} successfully`);
      setActionId(null);
      setActionStatus(null);
      await fetchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Success toast */}
      {success && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Expense Management</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Add Expense
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (() => {
        const pendingCount = expenses.filter((e) => e.status === "pending").length;
        const currentMonth = new Date().toISOString().substring(0, 7);
        const thisMonth = summary.byMonth?.find((m) => m.month === currentMonth)?.total ?? 0;
        const topCategory = summary.byCategory?.[0]?.category ?? "—";

        return (
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600 uppercase">
                  Total Approved
                </span>
                <DollarSign className="h-5 w-5 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                ${(summary.totalExpenses ?? 0).toLocaleString()}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600 uppercase">
                  Pending
                </span>
                <Receipt className="h-5 w-5 text-yellow-500" />
              </div>
              <div className="text-2xl font-bold text-yellow-600">
                {pendingCount}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600 uppercase">
                  This Month
                </span>
                <Receipt className="h-5 w-5 text-brand-600" />
              </div>
              <div className="text-2xl font-bold text-brand-600">
                ${thisMonth.toLocaleString()}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600 uppercase">
                  Top Category
                </span>
                <Filter className="h-5 w-5 text-slate-400" />
              </div>
              <div className="text-lg font-bold text-slate-900">
                {topCategory}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Filters */}
      <div className="grid gap-3 md:grid-cols-5">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Category
          </label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All Categories</option>
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Project
          </label>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All Projects</option>
            {projects.map((proj) => (
              <option key={proj} value={proj}>
                {proj}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            From
          </label>
          <input
            type="date"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            To
          </label>
          <input
            type="date"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Expenses Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center text-sm text-slate-400">
          No expenses found. Add your first expense to get started.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {[
                  "Date",
                  "Description",
                  "Category",
                  "Project",
                  "Amount",
                  "Submitted By",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredExpenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(exp.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {exp.description}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                        CATEGORY_COLORS[exp.category] ||
                          "bg-slate-100 text-slate-700"
                      )}
                    >
                      {exp.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {exp.project || "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    ${exp.amount.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{exp.submittedBy}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                        STATUS_COLORS[exp.status] ||
                          "bg-slate-100 text-slate-700"
                      )}
                    >
                      {exp.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {exp.status === "pending" && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleAction(exp.id, "approved")}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-green-50 hover:text-green-600"
                          title="Approve"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleAction(exp.id, "rejected")}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Reject"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Expense Modal */}
      {modalOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setModalOpen(false)}
          />
          <div className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                Add Expense
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Category <span className="text-red-500 ml-0.5">*</span>
                </label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">— Select Category —</option>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Description <span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="e.g., Flight ticket to NYC"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Amount ($) <span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amount: e.target.value }))
                  }
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  step="0.01"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Date <span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, date: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Project (optional)
                </label>
                <input
                  type="text"
                  value={form.project}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, project: e.target.value }))
                  }
                  placeholder="e.g., Project Alpha"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  placeholder="Additional details…"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  rows={2}
                />
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Add Expense
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Action Confirmation Modal */}
      {actionStatus && actionId && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => !processing && setActionStatus(null)}
          />
          <div className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div
                className={cn(
                  "mb-4 flex h-12 w-12 items-center justify-center rounded-full",
                  actionStatus === "approved"
                    ? "bg-green-100"
                    : "bg-red-100"
                )}
              >
                {actionStatus === "approved" ? (
                  <Check className="h-6 w-6 text-green-600" />
                ) : (
                  <X className="h-6 w-6 text-red-600" />
                )}
              </div>
              <h3 className="text-base font-semibold text-slate-900">
                {actionStatus === "approved"
                  ? "Approve Expense"
                  : "Reject Expense"}
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Are you sure you want to {actionStatus} this expense?
              </p>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => {
                  setActionStatus(null);
                  setActionId(null);
                }}
                disabled={processing}
                className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                disabled={processing}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-50",
                  actionStatus === "approved"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                )}
              >
                {processing && <Loader2 className="h-4 w-4 animate-spin" />}
                {actionStatus === "approved" ? "Approve" : "Reject"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
