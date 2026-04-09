"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  Download,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuditLog } from "@/types";

interface Filter {
  type: string;
  employeeId: string;
  fromDate: string;
  toDate: string;
}

// Badge color mapping for log types
const TYPE_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  // Approvals / Rejections
  correction_approved: { bg: "bg-green-100", text: "text-green-800" },
  correction_rejected: { bg: "bg-red-100", text: "text-red-800" },
  leave_approved: { bg: "bg-green-100", text: "text-green-800" },
  leave_rejected: { bg: "bg-red-100", text: "text-red-800" },
  expense_approved: { bg: "bg-green-100", text: "text-green-800" },
  expense_rejected: { bg: "bg-red-100", text: "text-red-800" },
  payroll_paid: { bg: "bg-green-100", text: "text-green-800" },

  // Creates
  employee_created: { bg: "bg-blue-100", text: "text-blue-800" },
  contract_created: { bg: "bg-blue-100", text: "text-blue-800" },

  // Updates / Modifications
  employee_updated: { bg: "bg-slate-100", text: "text-slate-800" },
  contract_updated: { bg: "bg-slate-100", text: "text-slate-800" },
  session_modified: { bg: "bg-slate-100", text: "text-slate-800" },
  settings_updated: { bg: "bg-slate-100", text: "text-slate-800" },

  // Deletes
  employee_deleted: { bg: "bg-red-100", text: "text-red-800" },

  // Other
  payroll_processed: { bg: "bg-purple-100", text: "text-purple-800" },
  bulk_operation: { bg: "bg-orange-100", text: "text-orange-800" },
};

// Pretty type labels
const TYPE_LABELS: Record<string, string> = {
  correction_approved: "Correction Approved",
  correction_rejected: "Correction Rejected",
  session_modified: "Session Modified",
  employee_created: "Employee Created",
  employee_updated: "Employee Updated",
  employee_deleted: "Employee Deleted",
  leave_approved: "Leave Approved",
  leave_rejected: "Leave Rejected",
  expense_approved: "Expense Approved",
  expense_rejected: "Expense Rejected",
  payroll_processed: "Payroll Processed",
  payroll_paid: "Payroll Paid",
  contract_created: "Contract Created",
  contract_updated: "Contract Updated",
  settings_updated: "Settings Updated",
  bulk_operation: "Bulk Operation",
};

export default function AuditLogViewerClient() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [allLogs, setAllLogs] = useState<AuditLog[]>([]); // Full dataset for pagination
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  const [filters, setFilters] = useState<Filter>({
    type: "",
    employeeId: "",
    fromDate: "",
    toDate: "",
  });

  // Unique types for filter dropdown
  const allTypes = Object.keys(TYPE_LABELS).sort();

  // Fetch logs
  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.type) params.append("type", filters.type);
      if (filters.employeeId) params.append("employeeId", filters.employeeId);
      if (filters.fromDate) params.append("from", filters.fromDate);
      if (filters.toDate) params.append("to", filters.toDate);
      params.append("limit", "500");

      const response = await fetch(`/api/audit-logs?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch audit logs");
      }
      const data = await response.json();
      const logs = Array.isArray(data.data) ? data.data : [];
      setAllLogs(logs);
      setPage(1); // Reset to first page on filter change
      setExpandedLogId(null); // Close any open rows
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Load initial logs
  useEffect(() => {
    fetchLogs();
  }, []);

  // Update displayed logs when page or all logs change
  useEffect(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    setLogs(allLogs.slice(start, end));
  }, [page, allLogs, pageSize]);

  // Handle filter changes
  const handleFilterChange = (key: keyof Filter, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Apply filters
  const handleApplyFilters = async () => {
    await fetchLogs();
  };

  // Reset filters
  const handleResetFilters = () => {
    setFilters({
      type: "",
      employeeId: "",
      fromDate: "",
      toDate: "",
    });
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (allLogs.length === 0) {
      alert("No logs to export");
      return;
    }

    // Build CSV header
    const headers = [
      "ID",
      "Timestamp",
      "Type",
      "Admin",
      "Employee ID",
      "Correction ID",
      "Session ID",
      "Note",
    ];
    const rows = allLogs.map((log) => [
      log.id,
      log.timestamp,
      log.type,
      log.adminName,
      log.employeeId || "",
      log.correctionId || "",
      log.sessionId || "",
      (log.note || "").replace(/"/g, '""'), // Escape quotes
    ]);

    // Build CSV content
    const csvContent = [
      headers.map((h) => `"${h}"`).join(","),
      ...rows.map((r) => r.map((v) => `"${v}"`).join(",")),
    ].join("\n");

    // Download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Generate description for a log
  const getLogDescription = (log: AuditLog): string => {
    const typeLabel = TYPE_LABELS[log.type] || log.type;
    const adminName = log.adminName;

    if (log.employeeId) {
      return `${adminName} ${typeLabel.toLowerCase()} for employee ${log.employeeId}`;
    }
    return `${adminName} performed: ${typeLabel.toLowerCase()}`;
  };

  // Total pages
  const totalPages = Math.ceil(allLogs.length / pageSize);

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Filters</h2>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Log Type
              </label>
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange("type", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                {allTypes.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            {/* Employee ID Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Employee ID
              </label>
              <input
                type="text"
                value={filters.employeeId}
                onChange={(e) => handleFilterChange("employeeId", e.target.value)}
                placeholder="emp_123"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* From Date Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                From Date
              </label>
              <input
                type="datetime-local"
                value={filters.fromDate}
                onChange={(e) => handleFilterChange("fromDate", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* To Date Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                To Date
              </label>
              <input
                type="datetime-local"
                value={filters.toDate}
                onChange={(e) => handleFilterChange("toDate", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleApplyFilters}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Apply Filters
            </button>

            <button
              onClick={handleResetFilters}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Reset
            </button>

            <button
              onClick={handleExportCSV}
              disabled={loading || allLogs.length === 0}
              className="ml-auto inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-200 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4">
          <div className="flex items-center gap-3 text-sm text-red-900">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && allLogs.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-white px-6 py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            <p className="text-sm text-slate-500">Loading audit logs...</p>
          </div>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-white px-6 py-12">
          <div className="text-center">
            <p className="text-sm text-slate-500">No audit logs found</p>
          </div>
        </div>
      ) : (
        <>
          {/* Logs Table */}
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-700">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-700">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-700">
                      Admin
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-700">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-700">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-700">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {logs.map((log) => {
                    const badgeColor = TYPE_BADGE_COLORS[log.type] || { bg: "bg-gray-100", text: "text-gray-800" };
                    const isExpanded = expandedLogId === log.id;

                    return (
                      <tr
                        key={log.id}
                        className={cn(
                          "hover:bg-slate-50",
                          isExpanded && "bg-blue-50"
                        )}
                      >
                        <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                              badgeColor.bg,
                              badgeColor.text
                            )}
                          >
                            {TYPE_LABELS[log.type] || log.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">
                          {log.adminName}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {log.employeeId || "—"}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {getLogDescription(log)}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() =>
                              setExpandedLogId(isExpanded ? null : log.id)
                            }
                            className="inline-flex items-center justify-center rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                          >
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 transition-transform",
                                isExpanded && "rotate-180"
                              )}
                            />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Expandable Details */}
            {logs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              if (!isExpanded) return null;

              return (
                <div
                  key={`expand-${log.id}`}
                  className="border-t border-slate-200 bg-slate-50 px-6 py-4"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">
                        Log Details
                      </h4>
                      <dl className="mt-2 space-y-2 text-sm">
                        {log.id && (
                          <div>
                            <dt className="font-medium text-slate-700">ID</dt>
                            <dd className="text-slate-600">{log.id}</dd>
                          </div>
                        )}
                        {log.correctionId && (
                          <div>
                            <dt className="font-medium text-slate-700">
                              Correction ID
                            </dt>
                            <dd className="text-slate-600">{log.correctionId}</dd>
                          </div>
                        )}
                        {log.sessionId && (
                          <div>
                            <dt className="font-medium text-slate-700">
                              Session ID
                            </dt>
                            <dd className="text-slate-600">{log.sessionId}</dd>
                          </div>
                        )}
                        {log.note && (
                          <div>
                            <dt className="font-medium text-slate-700">Note</dt>
                            <dd className="text-slate-600">{log.note}</dd>
                          </div>
                        )}
                      </dl>
                    </div>

                    {log.changes && log.changes.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">
                          Changes
                        </h4>
                        <div className="mt-2 space-y-2">
                          {log.changes.map((change, i) => (
                            <div
                              key={i}
                              className="rounded-lg bg-white p-2 text-sm"
                            >
                              <div className="font-medium text-slate-900">
                                {change.field}
                              </div>
                              <div className="text-slate-600">
                                <span className="line-through">
                                  {change.oldValue}
                                </span>
                                {" → "}
                                <span className="font-semibold text-green-700">
                                  {change.newValue}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="sm:col-span-2">
                        <h4 className="text-sm font-semibold text-slate-900">
                          Metadata
                        </h4>
                        <pre className="mt-2 overflow-x-auto rounded-lg bg-white p-2 text-xs text-slate-600">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-6 py-4">
              <p className="text-sm text-slate-600">
                Showing {(page - 1) * pageSize + 1} to{" "}
                {Math.min(page * pageSize, allLogs.length)} of {allLogs.length}{" "}
                logs
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="flex items-center px-3 py-1 text-sm font-medium text-slate-700">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
