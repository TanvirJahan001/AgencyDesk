"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CalendarDays,
  Check,
  X,
  Loader2,
  AlertTriangle,
  Filter,
  Plus,
  Settings,
  Save,
  Edit,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
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

interface Employee {
  uid: string;
  displayName: string;
  email: string;
  role: string;
}

interface BalanceCategory {
  total: number;
  used: number;
  remaining: number;
}

interface EmployeeLeaveBalance {
  id: string;
  employeeId: string;
  year: number;
  annual: BalanceCategory;
  sick: BalanceCategory;
  personal: BalanceCategory;
  updatedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-slate-100 text-slate-600",
};

type Tab = "pending" | "all" | "entitlements";

export default function AdminLeaveClient() {
  const [tab, setTab] = useState<Tab>("pending");
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allBalances, setAllBalances] = useState<EmployeeLeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [balancesLoading, setBalancesLoading] = useState(false);

  // Filters
  const [employeeFilter, setEmployeeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateStart, setDateStart] = useState<string>("");
  const [dateEnd, setDateEnd] = useState<string>("");

  // Action modal
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<
    "approved" | "rejected" | null
  >(null);
  const [actionNote, setActionNote] = useState("");
  const [processing, setProcessing] = useState(false);

  // Edit entitlement
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    annual: 20,
    sick: 10,
    personal: 5,
  });
  const [savingBalance, setSavingBalance] = useState(false);

  // Toasts
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Year selector for entitlements
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, empRes] = await Promise.all([
        fetch("/api/leave"),
        fetch("/api/employees"),
      ]);
      const reqJson = await reqRes.json();
      const empJson = await empRes.json();

      if (reqJson.success) setRequests(reqJson.data || []);
      if (empJson.success) setEmployees(empJson.data || []);
    } catch (err) {
      setError("Failed to load leave data");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBalances = useCallback(async () => {
    setBalancesLoading(true);
    try {
      const res = await fetch(`/api/leave/balances?year=${selectedYear}`);
      const json = await res.json();
      if (json.success) setAllBalances(json.data || []);
    } catch {
      setError("Failed to load leave balances");
    } finally {
      setBalancesLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (tab === "entitlements") {
      fetchBalances();
    }
  }, [tab, fetchBalances]);

  // ── Requests filtering ──────────────────────────────────────
  const filteredRequests = requests.filter((req) => {
    const statusMatch = !statusFilter || req.status === statusFilter;
    const employeeMatch =
      !employeeFilter || req.employeeId === employeeFilter;

    let dateMatch = true;
    if (dateStart) {
      dateMatch = new Date(req.startDate) >= new Date(dateStart);
    }
    if (dateEnd) {
      dateMatch = dateMatch && new Date(req.endDate) <= new Date(dateEnd);
    }

    if (tab === "pending") {
      return (
        req.status === "pending" && statusMatch && employeeMatch && dateMatch
      );
    }
    return statusMatch && employeeMatch && dateMatch;
  });

  // ── Approve / Reject ────────────────────────────────────────
  const handleAction = (id: string, status: "approved" | "rejected") => {
    setActionStatus(status);
    setActionId(id);
  };

  const confirmAction = async () => {
    if (!actionId || !actionStatus) return;

    setProcessing(true);
    try {
      const res = await fetch(`/api/leave/${actionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: actionStatus,
          reviewNote: actionNote,
        }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.error || "Failed to update leave request");
        return;
      }

      setSuccess(`Leave request ${actionStatus} successfully`);
      setActionId(null);
      setActionStatus(null);
      setActionNote("");
      await fetchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  // ── Entitlement helpers ─────────────────────────────────────
  function getBalanceForEmployee(
    empId: string
  ): EmployeeLeaveBalance | undefined {
    return allBalances.find((b) => b.employeeId === empId);
  }

  const startEditing = (empId: string) => {
    const existing = getBalanceForEmployee(empId);
    setEditForm({
      annual: existing?.annual.total ?? 20,
      sick: existing?.sick.total ?? 10,
      personal: existing?.personal.total ?? 5,
    });
    setEditingId(empId);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({ annual: 20, sick: 10, personal: 5 });
  };

  const saveEntitlement = async () => {
    if (!editingId) return;

    setSavingBalance(true);
    setError(null);
    try {
      const res = await fetch("/api/leave/balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: editingId,
          year: selectedYear,
          annual: { total: editForm.annual },
          sick: { total: editForm.sick },
          personal: { total: editForm.personal },
        }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.error || "Failed to update entitlement");
        return;
      }

      setSuccess("Leave entitlement updated successfully");
      setEditingId(null);
      await fetchBalances();
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSavingBalance(false);
    }
  };

  const initializeAllBalances = async () => {
    setSavingBalance(true);
    setError(null);
    let count = 0;

    try {
      for (const emp of employees) {
        const existing = getBalanceForEmployee(emp.uid);
        if (!existing) {
          const res = await fetch("/api/leave/balances", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              employeeId: emp.uid,
              year: selectedYear,
              annual: { total: 20 },
              sick: { total: 10 },
              personal: { total: 5 },
            }),
          });
          const json = await res.json();
          if (json.success) count++;
        }
      }

      if (count > 0) {
        setSuccess(`Initialized default balances for ${count} employee(s)`);
        await fetchBalances();
      } else {
        setSuccess("All employees already have balances for this year");
      }
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSavingBalance(false);
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
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-2 text-red-600 hover:text-red-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Leave Management</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-4 border-b border-slate-200">
            {(
              [
                { key: "pending", label: "Pending Requests" },
                { key: "all", label: "All Requests" },
                { key: "entitlements", label: "Leave Entitlements" },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                  tab === t.key
                    ? "border-brand-600 text-brand-600"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Entitlements Tab ─────────────────────────────── */}
          {tab === "entitlements" && (
            <div className="space-y-4">
              {/* Year selector + bulk init */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-slate-700">
                    Year:
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) =>
                      setSelectedYear(parseInt(e.target.value, 10))
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    {[currentYear - 1, currentYear, currentYear + 1].map(
                      (y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <button
                  onClick={initializeAllBalances}
                  disabled={savingBalance}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                >
                  {savingBalance ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Users className="h-4 w-4" />
                  )}
                  Initialize All Defaults
                </button>
              </div>

              {/* Info banner */}
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
                <strong>Defaults:</strong> Annual 20 days, Sick 10 days,
                Personal 5 days. Click the edit button on any employee to
                customize their entitlements.
              </div>

              {balancesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {[
                          "Employee",
                          "Annual (Used / Total)",
                          "Sick (Used / Total)",
                          "Personal (Used / Total)",
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
                      {employees.map((emp) => {
                        const bal = getBalanceForEmployee(emp.uid);
                        const isEditing = editingId === emp.uid;

                        return (
                          <tr
                            key={emp.uid}
                            className={cn(
                              "hover:bg-slate-50/60",
                              isEditing && "bg-brand-50/50"
                            )}
                          >
                            <td className="px-4 py-3">
                              <div>
                                <div className="font-medium text-slate-900">
                                  {emp.displayName}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {emp.email}
                                </div>
                              </div>
                            </td>

                            {/* Annual */}
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <input
                                  type="number"
                                  min={0}
                                  max={365}
                                  value={editForm.annual}
                                  onChange={(e) =>
                                    setEditForm((f) => ({
                                      ...f,
                                      annual: parseInt(e.target.value, 10) || 0,
                                    }))
                                  }
                                  className="w-20 rounded-lg border border-brand-300 px-2 py-1.5 text-sm text-center focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                />
                              ) : bal ? (
                                <div>
                                  <span className="font-medium text-slate-900">
                                    {bal.annual.used} / {bal.annual.total}
                                  </span>
                                  <span className="ml-2 text-xs text-slate-400">
                                    ({bal.annual.remaining} left)
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            {/* Sick */}
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <input
                                  type="number"
                                  min={0}
                                  max={365}
                                  value={editForm.sick}
                                  onChange={(e) =>
                                    setEditForm((f) => ({
                                      ...f,
                                      sick: parseInt(e.target.value, 10) || 0,
                                    }))
                                  }
                                  className="w-20 rounded-lg border border-brand-300 px-2 py-1.5 text-sm text-center focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                />
                              ) : bal ? (
                                <div>
                                  <span className="font-medium text-slate-900">
                                    {bal.sick.used} / {bal.sick.total}
                                  </span>
                                  <span className="ml-2 text-xs text-slate-400">
                                    ({bal.sick.remaining} left)
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            {/* Personal */}
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <input
                                  type="number"
                                  min={0}
                                  max={365}
                                  value={editForm.personal}
                                  onChange={(e) =>
                                    setEditForm((f) => ({
                                      ...f,
                                      personal:
                                        parseInt(e.target.value, 10) || 0,
                                    }))
                                  }
                                  className="w-20 rounded-lg border border-brand-300 px-2 py-1.5 text-sm text-center focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                />
                              ) : bal ? (
                                <div>
                                  <span className="font-medium text-slate-900">
                                    {bal.personal.used} / {bal.personal.total}
                                  </span>
                                  <span className="ml-2 text-xs text-slate-400">
                                    ({bal.personal.remaining} left)
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={saveEntitlement}
                                    disabled={savingBalance}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                                  >
                                    {savingBalance ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Save className="h-3.5 w-3.5" />
                                    )}
                                    Save
                                  </button>
                                  <button
                                    onClick={cancelEditing}
                                    disabled={savingBalance}
                                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => startEditing(emp.uid)}
                                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                  Edit
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {employees.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-12 text-center text-sm text-slate-400"
                          >
                            No employees found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Requests Tabs (Pending / All) ───────────────── */}
          {(tab === "pending" || tab === "all") && (
            <>
              {/* Filters - only show on "All Requests" tab */}
              {tab === "all" && (
                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Employee
                    </label>
                    <select
                      value={employeeFilter}
                      onChange={(e) => setEmployeeFilter(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      <option value="">All Employees</option>
                      {requests
                        .map((r) => ({
                          id: r.employeeId,
                          name: r.employeeName,
                        }))
                        .filter(
                          (v, i, a) => a.findIndex((x) => x.id === v.id) === i
                        )
                        .map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name}
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
                      <option value="cancelled">Cancelled</option>
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
              )}

              {/* Requests Table */}
              {filteredRequests.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center text-sm text-slate-400">
                  {tab === "pending"
                    ? "No pending leave requests"
                    : "No leave requests found"}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {[
                          "Employee",
                          "Type",
                          "Dates",
                          "Days",
                          "Reason",
                          "Status",
                          ...(tab === "pending" ? ["Actions"] : []),
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
                      {filteredRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-slate-50/60">
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {req.employeeName}
                          </td>
                          <td className="px-4 py-3 text-slate-600 capitalize">
                            {req.type}
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-xs">
                            {new Date(req.startDate).toLocaleDateString()} –{" "}
                            {new Date(req.endDate).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {req.totalDays}
                          </td>
                          <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                            {req.reason || "—"}
                          </td>
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
                          {tab === "pending" && (
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() =>
                                    handleAction(req.id, "approved")
                                  }
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-green-50 hover:text-green-600"
                                  title="Approve"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() =>
                                    handleAction(req.id, "rejected")
                                  }
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                  title="Reject"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
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
                  actionStatus === "approved" ? "bg-green-100" : "bg-red-100"
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
                  ? "Approve Leave Request"
                  : "Reject Leave Request"}
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                {actionStatus === "approved"
                  ? "This leave request will be approved and days deducted from balance."
                  : "This leave request will be rejected."}
              </p>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Review Note (optional)
              </label>
              <textarea
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="Add a note for the employee…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                rows={2}
              />
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => {
                  setActionStatus(null);
                  setActionId(null);
                  setActionNote("");
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
