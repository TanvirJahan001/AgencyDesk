"use client";

import { useState } from "react";
import {
  Building2,
  Clock,
  DollarSign,
  FileCheck,
  FileText,
  Loader2,
  Receipt,
  Users,
  Download,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface ExportableCollection {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
}

const COLLECTIONS: ExportableCollection[] = [
  {
    id: "users",
    name: "Users",
    description: "All employee and admin user accounts",
    icon: Users,
  },
  {
    id: "attendance_sessions",
    name: "Attendance Sessions",
    description: "Clock in/out records and attendance data",
    icon: Clock,
  },
  {
    id: "leave_requests",
    name: "Leave Requests",
    description: "All leave request submissions and approvals",
    icon: FileCheck,
  },
  {
    id: "expenses",
    name: "Expenses",
    description: "Employee expense reports and reimbursements",
    icon: DollarSign,
  },
  {
    id: "payroll_runs",
    name: "Payroll Runs",
    description: "Payroll processing history and records",
    icon: Receipt,
  },
  {
    id: "invoices",
    name: "Invoices",
    description: "Generated invoices and billing records",
    icon: FileText,
  },
  {
    id: "contracts",
    name: "Contracts",
    description: "Employee contracts and agreements",
    icon: FileCheck,
  },
  {
    id: "departments",
    name: "Departments",
    description: "Department structure and organization",
    icon: Building2,
  },
];

interface ExportState {
  loading: boolean;
  error: string | null;
}

export default function DataExportClient() {
  const [exportStates, setExportStates] = useState<Record<string, ExportState>>(
    COLLECTIONS.reduce((acc, col) => ({ ...acc, [col.id]: { loading: false, error: null } }), {})
  );

  const handleExport = async (collectionId: string, format: "json" | "csv") => {
    setExportStates((prev) => ({
      ...prev,
      [collectionId]: { loading: true, error: null },
    }));

    try {
      // Fetch JSON data first
      const response = await fetch(`/api/export?collection=${collectionId}`);

      if (!response.ok) {
        throw new Error("Failed to export data");
      }

      const data = await response.json();
      const jsonData = Array.isArray(data) ? data : [];

      if (format === "json") {
        // Download JSON directly
        const jsonString = JSON.stringify(jsonData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        downloadBlob(blob, `${collectionId}_export_${getDateString()}.json`);
      } else if (format === "csv") {
        // Convert to CSV
        const csv = convertToCSV(jsonData);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        downloadBlob(blob, `${collectionId}_export_${getDateString()}.csv`);
      }

      setExportStates((prev) => ({
        ...prev,
        [collectionId]: { loading: false, error: null },
      }));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred";
      setExportStates((prev) => ({
        ...prev,
        [collectionId]: { loading: false, error: errorMsg },
      }));
    }
  };

  const getDateString = (): string => {
    return new Date().toISOString().split("T")[0];
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Info box */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">Data Export & Backup</p>
            <p className="mt-1">
              Export up to 1000 records from each collection in JSON or CSV format.
              Use this for backups or data analysis.
            </p>
          </div>
        </div>
      </div>

      {/* Grid of export cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {COLLECTIONS.map((collection) => {
          const state = exportStates[collection.id] || { loading: false, error: null };
          const Icon = collection.icon;
          const isLoading = state.loading;

          return (
            <div
              key={collection.id}
              className="rounded-lg border border-slate-200 bg-white p-6 hover:shadow-sm transition-shadow"
            >
              {/* Header with icon and title */}
              <div className="flex items-start gap-3 mb-2">
                <div className="rounded-lg bg-slate-100 p-2.5">
                  <Icon className="h-5 w-5 text-slate-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">{collection.name}</h3>
                  <p className="text-sm text-slate-600 mt-0.5">{collection.description}</p>
                </div>
              </div>

              {/* Error message */}
              {state.error && (
                <div className="mt-3 rounded-md bg-red-50 p-2">
                  <p className="text-xs text-red-700">{state.error}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleExport(collection.id, "json")}
                  disabled={isLoading}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isLoading
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                      : "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800"
                  )}
                  title="Export as JSON"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  JSON
                </button>
                <button
                  onClick={() => handleExport(collection.id, "csv")}
                  disabled={isLoading}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isLoading
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                      : "bg-slate-600 text-white hover:bg-slate-700 active:bg-slate-800"
                  )}
                  title="Export as CSV"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  CSV
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Notes section */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h4 className="font-semibold text-slate-900 mb-2">Export Notes</h4>
        <ul className="text-sm text-slate-600 space-y-1">
          <li>• Each export includes up to 1000 records from the selected collection</li>
          <li>• JSON format preserves all data types and nested structures</li>
          <li>• CSV format flattens data and is compatible with spreadsheet applications</li>
          <li>• Exports are generated on-demand and include all fields</li>
          <li>• All exports include a timestamp in the filename for easy version tracking</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Convert JSON array to CSV format
 */
function convertToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";

  // Get all unique keys from all objects
  const allKeys = new Set<string>();
  data.forEach((obj) => {
    Object.keys(obj).forEach((key) => allKeys.add(key));
  });

  const headers = Array.from(allKeys);
  const rows: string[] = [headers.map(escapeCSV).join(",")];

  // Add data rows
  data.forEach((obj) => {
    const row = headers.map((header) => {
      const value = obj[header];
      const stringValue = stringifyValue(value);
      return escapeCSV(stringValue);
    });
    rows.push(row.join(","));
  });

  return rows.join("\n");
}

/**
 * Escape CSV values (add quotes if needed)
 */
function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Convert any value to string for CSV
 */
function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return value.toString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
