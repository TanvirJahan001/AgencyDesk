/**
 * components/reports/ReportsDashboard.tsx
 *
 * Admin reports page:
 *  - Weekly attendance Excel export
 *  - Monthly payroll Excel export
 *  - Printable payroll PDF summary
 *  - Employee filter
 *  - Download links
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import type { AppUser } from "@/types";
import { cn } from "@/lib/utils";
import {
  FileSpreadsheet,
  FileText,
  Download,
  Loader2,
  Users,
  CalendarDays,
} from "lucide-react";

type ReportType = "weekly-attendance" | "monthly-payroll" | "payroll-pdf";

interface ReportCard {
  type: ReportType;
  label: string;
  description: string;
  icon: React.ElementType;
  fileType: string;
  periodPlaceholder: string;
  periodType: "weekly" | "monthly";
}

const REPORTS: ReportCard[] = [
  {
    type: "weekly-attendance",
    label: "Weekly Attendance",
    description: "Day-by-day attendance hours for each employee in a week. Includes work/break breakdown and totals.",
    icon: FileSpreadsheet,
    fileType: "Excel (.xlsx)",
    periodPlaceholder: "2026-W15",
    periodType: "weekly",
  },
  {
    type: "monthly-payroll",
    label: "Monthly Payroll",
    description: "Full payroll breakdown with regular hours, overtime, rates, gross/net pay, and deductions.",
    icon: FileSpreadsheet,
    fileType: "Excel (.xlsx)",
    periodPlaceholder: "2026-04",
    periodType: "monthly",
  },
  {
    type: "payroll-pdf",
    label: "Payroll Summary (PDF)",
    description: "Printable company-ready payroll summary with branded header, totals, and detail table.",
    icon: FileText,
    fileType: "PDF",
    periodPlaceholder: "2026-04",
    periodType: "monthly",
  },
];

export default function ReportsDashboard() {
  const [employees, setEmployees] = useState<AppUser[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [periods, setPeriods] = useState<Record<ReportType, string>>({
    "weekly-attendance": "",
    "monthly-payroll": "",
    "payroll-pdf": "",
  });
  const [downloading, setDownloading] = useState<ReportType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch employees for filter
  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/payroll/rates");
      const data = await res.json();
      if (data.success) setEmployees(data.data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  // Auto-set default periods
  useEffect(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");

    // Compute ISO week
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    const weekYear = d.getUTCFullYear();

    setPeriods({
      "weekly-attendance": `${weekYear}-W${String(week).padStart(2, "0")}`,
      "monthly-payroll": `${y}-${m}`,
      "payroll-pdf": `${y}-${m}`,
    });
  }, []);

  async function handleDownload(type: ReportType) {
    const period = periods[type];
    if (!period.trim()) {
      setError("Please enter a period.");
      return;
    }

    setDownloading(type);
    setError(null);
    setSuccess(null);

    try {
      const params = new URLSearchParams({ type, period });
      if (selectedEmployee) params.set("employeeId", selectedEmployee);

      const res = await fetch(`/api/reports?${params.toString()}`);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Download failed." }));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }

      // Download the file
      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition") || "";
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] || `report_${type}_${period}.${type.includes("pdf") ? "pdf" : "xlsx"}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess(`${REPORTS.find((r) => r.type === type)?.label} downloaded successfully.`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Employee filter ────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <Users className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">Employee Filter</h3>
        </div>
        <select
          value={selectedEmployee}
          onChange={(e) => setSelectedEmployee(e.target.value)}
          className="w-full max-w-sm rounded-lg border border-gray-300 py-2 pl-3 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">All Employees</option>
          {employees.map((emp) => (
            <option key={emp.uid} value={emp.uid}>
              {emp.displayName} — {emp.email}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-gray-400">
          Leave blank to include all employees in the report.
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
          <button onClick={() => setSuccess(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* ── Report cards ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {REPORTS.map((report) => {
          const Icon = report.icon;
          const isDownloading = downloading === report.type;
          const isExcel = report.fileType.includes("xlsx");

          return (
            <div
              key={report.type}
              className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
            >
              {/* Card header */}
              <div className={cn(
                "px-5 py-4 border-b border-gray-100",
                isExcel ? "bg-green-50/50" : "bg-red-50/50"
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    isExcel ? "bg-green-100" : "bg-red-100"
                  )}>
                    <Icon className={cn("h-5 w-5", isExcel ? "text-green-700" : "text-red-700")} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{report.label}</h3>
                    <p className="text-xs text-gray-500">{report.fileType}</p>
                  </div>
                </div>
              </div>

              {/* Card body */}
              <div className="flex-1 px-5 py-4">
                <p className="text-sm text-gray-600 leading-relaxed">{report.description}</p>

                <div className="mt-4">
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-600">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {report.periodType === "weekly" ? "Week" : "Month"}
                  </label>
                  <input
                    type="text"
                    value={periods[report.type]}
                    onChange={(e) => setPeriods((p) => ({ ...p, [report.type]: e.target.value }))}
                    placeholder={report.periodPlaceholder}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Card footer */}
              <div className="border-t border-gray-100 px-5 py-3">
                <button
                  type="button"
                  onClick={() => handleDownload(report.type)}
                  disabled={isDownloading || !periods[report.type].trim()}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    isExcel
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-red-600 hover:bg-red-700"
                  )}
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Download {report.fileType}
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
