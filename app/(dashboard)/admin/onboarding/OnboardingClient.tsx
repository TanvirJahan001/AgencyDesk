/**
 * app/(dashboard)/admin/onboarding/OnboardingClient.tsx
 *
 * Dual-tab component for Onboarding and Offboarding management:
 * - Table view with status filters
 * - Expandable rows to show checklists
 * - Modals to create new records
 * - Inline editing for checklist items
 */

"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Trash2,
  AlertCircle,
} from "lucide-react";
import type {
  OnboardingRecord,
  OffboardingRecord,
  ChecklistItem,
  AppUser,
} from "@/types";

// Tabs
type TabType = "onboarding" | "offboarding";

// Modal state
interface CreateModalState {
  isOpen: boolean;
  employeeId: string;
  startDate?: string;
  lastDay?: string;
  reason?: "resignation" | "termination" | "retirement" | "contract_end" | "other";
}

export function OnboardingClient({ employees }: { employees: AppUser[] }) {
  const [activeTab, setActiveTab] = useState<TabType>("onboarding");
  const [onboardingRecords, setOnboardingRecords] = useState<OnboardingRecord[]>(
    []
  );
  const [offboardingRecords, setOffboardingRecords] = useState<OffboardingRecord[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createModal, setCreateModal] = useState<CreateModalState>({
    isOpen: false,
    employeeId: "",
  });
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch records
  useEffect(() => {
    const fetchRecords = async () => {
      try {
        setLoading(true);
        setError(null);

        const query =
          statusFilter !== "all" ? `?status=${statusFilter}` : "";

        const [onboardRes, offboardRes] = await Promise.all([
          fetch(`/api/onboarding${query}`),
          fetch(`/api/offboarding${query}`),
        ]);

        if (!onboardRes.ok) {
          throw new Error("Failed to fetch onboarding records");
        }
        if (!offboardRes.ok) {
          throw new Error("Failed to fetch offboarding records");
        }

        const onboardData = await onboardRes.json();
        const offboardData = await offboardRes.json();

        setOnboardingRecords(onboardData.data || []);
        setOffboardingRecords(offboardData.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [statusFilter]);

  const handleCreateOnboarding = async () => {
    if (!createModal.employeeId || !createModal.startDate) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: createModal.employeeId,
          startDate: createModal.startDate,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create onboarding");
      }

      const data = await res.json();
      setOnboardingRecords([data.data, ...onboardingRecords]);
      setCreateModal({ isOpen: false, employeeId: "" });
    } catch (err) {
      alert(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleCreateOffboarding = async () => {
    if (
      !createModal.employeeId ||
      !createModal.lastDay ||
      !createModal.reason
    ) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      const res = await fetch("/api/offboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: createModal.employeeId,
          lastDay: createModal.lastDay,
          reason: createModal.reason,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create offboarding");
      }

      const data = await res.json();
      setOffboardingRecords([data.data, ...offboardingRecords]);
      setCreateModal({ isOpen: false, employeeId: "" });
    } catch (err) {
      alert(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleUpdateChecklistItem = async (
    recordId: string,
    itemId: string,
    completed: boolean,
    notes?: string
  ) => {
    const isOnboarding = activeTab === "onboarding";
    const records = isOnboarding ? onboardingRecords : offboardingRecords;
    const record = records.find((r) => r.id === recordId);

    if (!record) return;

    const updatedChecklist = record.checklist.map((item) =>
      item.id === itemId ? { ...item, completed, notes } : item
    );

    try {
      const endpoint = isOnboarding ? "/api/onboarding" : "/api/offboarding";
      const res = await fetch(`${endpoint}/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist: updatedChecklist }),
      });

      if (!res.ok) {
        throw new Error("Failed to update checklist");
      }

      const data = await res.json();
      if (isOnboarding) {
        setOnboardingRecords(
          onboardingRecords.map((r) => (r.id === recordId ? data.data : r))
        );
      } else {
        setOffboardingRecords(
          offboardingRecords.map((r) => (r.id === recordId ? data.data : r))
        );
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (!window.confirm("Are you sure? This cannot be undone.")) return;

    try {
      const isOnboarding = activeTab === "onboarding";
      const endpoint = isOnboarding ? "/api/onboarding" : "/api/offboarding";
      const res = await fetch(`${endpoint}/${recordId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete record");
      }

      if (isOnboarding) {
        setOnboardingRecords(
          onboardingRecords.filter((r) => r.id !== recordId)
        );
      } else {
        setOffboardingRecords(
          offboardingRecords.filter((r) => r.id !== recordId)
        );
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getReasonColor = (reason: string) => {
    switch (reason) {
      case "resignation":
        return "bg-blue-100 text-blue-800";
      case "termination":
        return "bg-red-100 text-red-800";
      case "retirement":
        return "bg-amber-100 text-amber-800";
      case "contract_end":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const calculateProgress = (checklist: ChecklistItem[]) => {
    const completed = checklist.filter((item) => item.completed).length;
    const total = checklist.length;
    return { completed, total, percentage: Math.round((completed / total) * 100) };
  };

  const records = activeTab === "onboarding" ? onboardingRecords : offboardingRecords;

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8" aria-label="Tabs">
          {(["onboarding", "offboarding"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setExpandedId(null);
                setStatusFilter("all");
              }}
              className={`px-1 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab === "onboarding" ? "Onboarding" : "Offboarding"}
            </button>
          ))}
        </nav>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">All Status</option>
            {activeTab === "onboarding" ? (
              <>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </>
            ) : (
              <>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </>
            )}
          </select>
        </div>

        <button
          onClick={() =>
            setCreateModal({
              isOpen: true,
              employeeId: "",
              ...(activeTab === "onboarding"
                ? { startDate: "" }
                : { lastDay: "", reason: undefined }),
            })
          }
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 transition-colors text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Start {activeTab === "onboarding" ? "Onboarding" : "Offboarding"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md flex items-gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Loading records...</p>
        </div>
      )}

      {/* Records Table */}
      {!loading && records.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No records found</p>
        </div>
      )}

      {!loading && records.length > 0 && (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200">
                <th className="px-6 py-3 text-left font-semibold text-gray-900">
                  Employee
                </th>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">
                  Department
                </th>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">
                  {activeTab === "onboarding" ? "Start Date" : "Last Day"}
                </th>
                {activeTab === "offboarding" && (
                  <th className="px-6 py-3 text-left font-semibold text-gray-900">
                    Reason
                  </th>
                )}
                <th className="px-6 py-3 text-left font-semibold text-gray-900">
                  Progress
                </th>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">
                  Status
                </th>
                <th className="px-6 py-3 text-right font-semibold text-gray-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {records.map((record, idx) => {
                const isExpanded = expandedId === record.id;
                const progress = calculateProgress(record.checklist);
                const isOnboarding = activeTab === "onboarding";
                const rec = record as any;

                return (
                  <tbody key={record.id}>
                    <tr className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-6 py-4">{record.employeeName}</td>
                      <td className="px-6 py-4 text-gray-600">
                        {record.department || "-"}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {isOnboarding
                          ? (record as OnboardingRecord).startDate
                          : (record as OffboardingRecord).lastDay}
                      </td>
                      {!isOnboarding && (
                        <td className="px-6 py-4">
                          <span
                            className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${getReasonColor(
                              (record as OffboardingRecord).reason
                            )}`}
                          >
                            {(record as OffboardingRecord).reason
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, (l) => l.toUpperCase())}
                          </span>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-600 transition-all"
                              style={{ width: `${progress.percentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600">
                            {progress.completed}/{progress.total}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${getStatusColor(
                            record.status
                          )}`}
                        >
                          {record.status
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (l) => l.toUpperCase())}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() =>
                            setExpandedId(isExpanded ? null : record.id)
                          }
                          className="text-brand-600 hover:text-brand-800"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="space-y-4">
                            <h4 className="font-semibold text-gray-900">
                              Checklist
                            </h4>
                            <div className="space-y-2">
                              {record.checklist.map((item) => (
                                <label
                                  key={item.id}
                                  className="flex items-center gap-3 p-2 hover:bg-white rounded cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={item.completed}
                                    onChange={(e) =>
                                      handleUpdateChecklistItem(
                                        record.id,
                                        item.id,
                                        e.target.checked
                                      )
                                    }
                                    className="w-4 h-4 rounded"
                                  />
                                  <span
                                    className={`text-sm ${
                                      item.completed
                                        ? "line-through text-gray-500"
                                        : "text-gray-900"
                                    }`}
                                  >
                                    {item.title}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleDeleteRecord(record.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {createModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Start {activeTab === "onboarding" ? "Onboarding" : "Offboarding"}
            </h2>

            <div className="space-y-4">
              {/* Employee Select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee *
                </label>
                <select
                  value={createModal.employeeId}
                  onChange={(e) =>
                    setCreateModal({ ...createModal, employeeId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Select an employee</option>
                  {employees.map((emp) => (
                    <option key={emp.uid} value={emp.uid}>
                      {emp.displayName} ({emp.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Fields */}
              {activeTab === "onboarding" ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={createModal.startDate || ""}
                    onChange={(e) =>
                      setCreateModal({ ...createModal, startDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Day *
                    </label>
                    <input
                      type="date"
                      value={createModal.lastDay || ""}
                      onChange={(e) =>
                        setCreateModal({ ...createModal, lastDay: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reason *
                    </label>
                    <select
                      value={createModal.reason || ""}
                      onChange={(e) =>
                        setCreateModal({
                          ...createModal,
                          reason: e.target.value as any,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="">Select a reason</option>
                      <option value="resignation">Resignation</option>
                      <option value="termination">Termination</option>
                      <option value="retirement">Retirement</option>
                      <option value="contract_end">Contract End</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() =>
                  setCreateModal({ isOpen: false, employeeId: "" })
                }
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  activeTab === "onboarding"
                    ? handleCreateOnboarding()
                    : handleCreateOffboarding()
                }
                className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-medium hover:bg-brand-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
