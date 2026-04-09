"use client";

import { useEffect, useState } from "react";
import { Check, AlertCircle, Loader2, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CronRunLog } from "@/types";

export default function CronMonitoringDashboard() {
  const [logs, setLogs] = useState<CronRunLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Fetch cron logs
  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/cron/runs");
      if (!response.ok) {
        throw new Error("Failed to fetch cron logs");
      }
      const data = await response.json();
      setLogs(Array.isArray(data) ? data : data.logs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    fetchLogs();

    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchLogs();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Trigger manual job
  const triggerJob = async (endpoint: string, jobName: string) => {
    try {
      setTriggeringJob(jobName);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Failed to trigger ${jobName}`);
      }

      // Refresh logs after triggering
      await fetchLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trigger job");
    } finally {
      setTriggeringJob(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Run Now Section */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Run Jobs Now</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            onClick={() => triggerJob("/api/cron/daily-missed-checkout", "Detect Missed Checkouts")}
            disabled={triggeringJob !== null}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              triggeringJob === "Detect Missed Checkouts"
                ? "bg-slate-100 text-slate-700"
                : "bg-slate-100 text-slate-900 hover:bg-slate-200"
            )}
          >
            {triggeringJob === "Detect Missed Checkouts" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCw className="h-4 w-4" />
            )}
            Detect Missed Checkouts
          </button>

          <button
            onClick={() => triggerJob("/api/cron/weekly-ceo-report", "Weekly CEO Summary")}
            disabled={triggeringJob !== null}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              triggeringJob === "Weekly CEO Summary"
                ? "bg-slate-100 text-slate-700"
                : "bg-slate-100 text-slate-900 hover:bg-slate-200"
            )}
          >
            {triggeringJob === "Weekly CEO Summary" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCw className="h-4 w-4" />
            )}
            Weekly CEO Summary
          </button>

          <button
            onClick={() => triggerJob("/api/cron/invoice-maintenance", "Invoice Maintenance")}
            disabled={triggeringJob !== null}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              triggeringJob === "Invoice Maintenance"
                ? "bg-slate-100 text-slate-700"
                : "bg-slate-100 text-slate-900 hover:bg-slate-200"
            )}
          >
            {triggeringJob === "Invoice Maintenance" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCw className="h-4 w-4" />
            )}
            Invoice Maintenance
          </button>
        </div>
      </div>

      {/* Logs Section */}
      <div className="rounded-lg border border-slate-200 bg-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Execution Logs</h2>
            <p className="mt-0.5 text-sm text-slate-500">Recent cron job runs</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                autoRefresh
                  ? "bg-blue-100 text-blue-900"
                  : "bg-slate-100 text-slate-900 hover:bg-slate-200"
              )}
            >
              <RotateCw className={cn("h-4 w-4", autoRefresh && "animate-spin")} />
              {autoRefresh ? "Auto-refresh On" : "Auto-refresh Off"}
            </button>
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-200 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCw className="h-4 w-4" />
              )}
              Refresh
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="border-b border-slate-200 bg-red-50 px-6 py-4">
            <div className="flex items-center gap-3 text-sm text-red-900">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center px-6 py-12">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              <p className="text-sm text-slate-500">Loading cron logs...</p>
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex items-center justify-center px-6 py-12">
            <div className="text-center">
              <p className="text-sm text-slate-500">No cron logs found</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-700">
                    Job Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-700">
                    Triggered By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-700">
                    Started At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-700">
                    Completed At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-700">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-700">
                    Summary
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-700">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{log.jobName}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{log.triggeredBy}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(log.startedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {log.completedAt ? new Date(log.completedAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          log.status === "success"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        )}
                      >
                        {log.status === "success" ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <AlertCircle className="h-3 w-3" />
                        )}
                        {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                      </span>
                    </td>
                    <td className="max-w-xs truncate px-6 py-4 text-sm text-slate-600">
                      {log.summary}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() =>
                          setExpandedId(expandedId === log.id ? null : log.id)
                        }
                        className="text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        {expandedId === log.id ? "Hide" : "Show"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Expanded Details Row */}
            {expandedId && (
              <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Details for{" "}
                  {logs.find((log) => log.id === expandedId)?.jobName}
                </h3>
                <pre className="overflow-x-auto rounded bg-slate-900 p-4 text-xs text-slate-100">
                  {JSON.stringify(
                    logs.find((log) => log.id === expandedId)?.details,
                    null,
                    2
                  )}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
