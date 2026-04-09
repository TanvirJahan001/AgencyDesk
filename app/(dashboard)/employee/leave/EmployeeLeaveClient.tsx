"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CalendarDays,
  Plus,
  Check,
  X,
  Loader2,
  AlertTriangle,
  Edit,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LeaveBalanceItem {
  type: string;
  total: number;
  used: number;
  remaining: number;
}

interface LeaveRequest {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reviewNote?: string;
  reviewerName?: string;
  reviewedAt?: string;
  createdAt: string;
}

// Leave types sent to API must be lowercase
const LEAVE_TYPES = [
  { label: "Annual", value: "annual" },
  { label: "Sick", value: "sick" },
  { label: "Personal", value: "personal" },
  { label: "Unpaid", value: "unpaid" },
];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-slate-100 text-slate-600",
};

/**
 * Transform raw Firestore balance doc into a flat array for display.
 * The API returns: { annual: {total,used,remaining}, sick: {...}, personal: {...} }
 * We need: [ {type:"Annual", total, used, remaining}, ... ]
 */
function transformBalances(rawBalances: Record<string, unknown>[]): LeaveBalanceItem[] {
  const types = [
    { key: "annual", label: "Annual" },
    { key: "sick", label: "Sick" },
    { key: "personal", label: "Personal" },
  ];
  const items: LeaveBalanceItem[] = [];

  for (const balance of rawBalances) {
    for (const { key, label } of types) {
      const typeData = balance[key] as { total: number; used: number; remaining: number } | undefined;
      if (typeData) {
        items.push({
          type: label,
          total: typeData.total,
          used: typeData.used,
          remaining: typeData.remaining,
        });
      }
    }
  }

  // If no balance record exists, show defaults with 0/0
  if (items.length === 0) {
    return types.map(({ label }) => ({ type: label, total: 0, used: 0, remaining: 0 }));
  }

  return items;
}

export default function EmployeeLeaveClient() {
  const [balances, setBalances] = useState<LeaveBalanceItem[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    leaveType: "",
    startDate: "",
    endDate: "",
    reason: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const currentYear = new Date().getFullYear();
      const [balRes, reqRes] = await Promise.all([
        fetch(`/api/leave/balances?year=${currentYear}&mine=true`),
        fetch("/api/leave?mine=true"),
      ]);
      const balJson = await balRes.json();
      const reqJson = await reqRes.json();

      if (balJson.success) {
        setBalances(transformBalances(balJson.data || []));
      }
      if (reqJson.success) setRequests(reqJson.data || []);
    } catch (err) {
      setError("Failed to load leave data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.leaveType || !form.startDate || !form.endDate) {
      setError("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.leaveType,
          startDate: form.startDate,
          endDate: form.endDate,
          reason: form.reason,
        }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.error || "Failed to submit leave request");
        return;
      }

      setSuccess("Leave request submitted successfully");
      setForm({ leaveType: "", startDate: "", endDate: "", reason: "" });
      setModalOpen(false);
      await fetchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/leave/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.error || "Failed to cancel request");
        return;
      }

      setSuccess("Leave request cancelled");
      setCancelConfirm(null);
      await fetchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDeleting(false);
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

      {/* Leave Balances */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      ) : (
        <>
          <div>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              My Leave Balances
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {balances.length === 0 ? (
                <div className="col-span-full rounded-lg border border-dashed border-slate-300 py-8 text-center text-sm text-slate-400">
                  No leave balances available
                </div>
              ) : (
                balances.map((balance) => {
                  const percent = balance.total > 0 ? (balance.used / balance.total) * 100 : 0;
                  return (
                    <div
                      key={balance.type}
                      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-slate-900">
                          {balance.type}
                        </h3>
                        <CalendarDays className="h-5 w-5 text-brand-600" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Used / Total</span>
                          <span className="font-semibold text-slate-900">
                            {balance.used} / {balance.total}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-brand-600 transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="text-sm font-medium text-slate-700">
                          {balance.remaining} remaining
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Request Leave Button */}
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Request Leave
          </button>

          {/* Leave Requests Table */}
          <div>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              My Leave Requests
            </h2>
            {requests.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center text-sm text-slate-400">
                No leave requests yet. Submit your first request to get started.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {[
                        "Type",
                        "Start Date",
                        "End Date",
                        "Days",
                        "Status",
                        "Reason",
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
                    {requests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-medium text-slate-900 capitalize">
                          {req.type}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {new Date(req.startDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {new Date(req.endDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{req.totalDays}</td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                              STATUS_COLORS[req.status] ||
                                "bg-slate-100 text-slate-700"
                            )}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                          {req.reason || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {req.status === "pending" && (
                            <button
                              onClick={() => setCancelConfirm(req.id)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              title="Cancel request"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Request Leave Modal */}
      {modalOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setModalOpen(false)}
          />
          <div className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                Request Leave
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
                  Leave Type <span className="text-red-500 ml-0.5">*</span>
                </label>
                <select
                  value={form.leaveType}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, leaveType: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">— Select Type —</option>
                  {LEAVE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Start Date <span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, startDate: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  End Date <span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, endDate: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Reason
                </label>
                <textarea
                  value={form.reason}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, reason: e.target.value }))
                  }
                  placeholder="Optional reason for your leave request…"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  rows={3}
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
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelConfirm && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => !deleting && setCancelConfirm(null)}
          />
          <div className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-sm -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">
                Cancel Leave Request
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Are you sure you want to cancel this leave request? This action
                cannot be undone.
              </p>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setCancelConfirm(null)}
                disabled={deleting}
                className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Keep Request
              </button>
              <button
                onClick={() => handleCancel(cancelConfirm)}
                disabled={deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                Cancel Request
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
