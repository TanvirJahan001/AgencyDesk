"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Clock,
  FileEdit,
  FileBarChart,
  Loader2,
  Megaphone,
  Receipt,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface ActivityEntry {
  id: string;
  type: "audit_log" | "leave_request" | "expense" | "correction_request" | "announcement";
  title: string;
  description: string;
  timestamp: string;
  actorName: string;
  actorId: string;
  metadata?: Record<string, unknown>;
}

const TYPE_ICONS: Record<ActivityEntry["type"], LucideIcon> = {
  audit_log: FileBarChart,
  leave_request: Clock,
  expense: Receipt,
  correction_request: FileEdit,
  announcement: Megaphone,
};

const TYPE_COLORS: Record<ActivityEntry["type"], { dot: string; icon: string }> = {
  audit_log: { dot: "bg-blue-500", icon: "text-blue-600" },
  leave_request: { dot: "bg-amber-500", icon: "text-amber-600" },
  expense: { dot: "bg-green-500", icon: "text-green-600" },
  correction_request: { dot: "bg-orange-500", icon: "text-orange-600" },
  announcement: { dot: "bg-purple-500", icon: "text-purple-600" },
};

const TYPE_LABELS: Record<ActivityEntry["type"], string> = {
  audit_log: "Audit Log",
  leave_request: "Leave Request",
  expense: "Expense",
  correction_request: "Correction",
  announcement: "Announcement",
};

function getRelativeTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return "unknown";
  }
}

export default function ActivityFeedClient() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<ActivityEntry["type"] | "all">("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const fetchActivity = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/activity?limit=100");
      if (!response.ok) {
        throw new Error("Failed to fetch activity feed");
      }

      const json = await response.json();
      const data = json.data || json || [];
      setEntries(Array.isArray(data) ? data : []);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivity();
    const interval = setInterval(fetchActivity, 30000); // Auto-refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const filteredEntries = selectedType === "all"
    ? entries
    : entries.filter((e) => e.type === selectedType);

  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const paginatedEntries = filteredEntries.slice(start, end);
  const totalPages = Math.ceil(filteredEntries.length / pageSize);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-brand-600" />
          <p className="text-sm text-slate-600">Loading activity feed...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">{error}</p>
        <button
          onClick={fetchActivity}
          className="mt-2 text-sm font-medium text-red-600 hover:text-red-700"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => {
            setSelectedType("all");
            setPage(1);
          }}
          className={cn(
            "whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
            selectedType === "all"
              ? "bg-brand-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          )}
        >
          All
        </button>
        {(Object.keys(TYPE_LABELS) as ActivityEntry["type"][]).map((type) => (
          <button
            key={type}
            onClick={() => {
              setSelectedType(type);
              setPage(1);
            }}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              selectedType === type
                ? "bg-brand-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            )}
          >
            {TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {paginatedEntries.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-600">No activity found for the selected filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedEntries.map((entry) => {
            const IconComponent = TYPE_ICONS[entry.type];
            const colors = TYPE_COLORS[entry.type];
            const relativeTime = getRelativeTime(entry.timestamp);

            return (
              <div key={entry.id} className="flex gap-4 py-3">
                {/* Timeline dot and line */}
                <div className="flex flex-col items-center gap-2">
                  <div className={cn("rounded-full p-2", `${colors.icon} bg-opacity-10`)}>
                    <IconComponent className={cn("h-4 w-4", colors.icon)} />
                  </div>
                  {/* Line extends only between items */}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">{entry.title}</p>
                      <p className="text-sm text-slate-600 mt-0.5">{entry.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        <span>{entry.actorName}</span>
                        <span>·</span>
                        <span>{relativeTime}</span>
                      </div>
                    </div>
                    <span className={cn(
                      "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium flex-shrink-0",
                      colors.dot,
                      "text-white"
                    )}>
                      {TYPE_LABELS[entry.type]}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-slate-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
