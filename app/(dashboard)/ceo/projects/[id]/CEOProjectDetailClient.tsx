"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Calendar,
  Users,
  Clock,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project, Task, TimeLog } from "@/types";
import { TASK_STATUSES } from "@/types";

interface TaskWithExtras extends Task {
  comments?: TaskComment[];
}

interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export default function CEOProjectDetailClient({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<TaskWithExtras[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects?id=${projectId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setProject(json.data);
      }
    } catch {
      setError("Failed to load project");
    }
  }, [projectId]);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks?projectId=${projectId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setTasks(json.data);
      }
    } catch {
      // silent
    }
  }, [projectId]);

  const fetchTimeLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/time-logs?projectId=${projectId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setTimeLogs(json.data);
      }
    } catch {
      // silent
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchProject(),
      fetchTasks(),
      fetchTimeLogs(),
    ]).finally(() => setLoading(false));
  }, [fetchProject, fetchTasks, fetchTimeLogs]);

  const tasksByStatus = TASK_STATUSES.map((status) => ({
    ...status,
    count: tasks.filter((t) => t.status === status.value).length,
  }));

  const totalHours = timeLogs.reduce((sum, log) => sum + log.minutes, 0) / 60;
  const budgetRemaining = project ? project.budget - project.spent : 0;
  const budgetPercentage = project ? (project.spent / project.budget) * 100 : 0;

  const isOverdue = project && new Date(project.deadline) < new Date();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
        Project not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error toast */}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Back button and header */}
      <div className="flex items-center gap-4">
        <Link
          href="/ceo/projects"
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          title="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
          <p className="text-sm text-slate-500">{project.clientName}</p>
        </div>
      </div>

      {/* Section A: Project Info Card (Read-only) */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Left column */}
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500 mb-1">Status</p>
              <p className="inline-flex rounded-full px-3 py-1 text-sm font-medium bg-blue-100 text-blue-700">
                {project.status}
              </p>
            </div>
            {project.serviceType && (
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500 mb-1">Service Type</p>
                <p className="text-sm text-slate-700">{project.serviceType}</p>
              </div>
            )}
            {project.description && (
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500 mb-1">Description</p>
                <p className="text-sm text-slate-700 line-clamp-3">{project.description}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500 mb-1">Project Manager</p>
              <p className="text-sm text-slate-700">{project.managerName}</p>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Budget Status</p>
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-900">
                  ${project.spent.toLocaleString()} of ${project.budget.toLocaleString()} ({budgetPercentage.toFixed(1)}%)
                </p>
                <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-colors",
                      budgetPercentage > 90
                        ? "bg-red-500"
                        : budgetPercentage > 70
                        ? "bg-yellow-500"
                        : "bg-green-500"
                    )}
                    style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                  />
                </div>
                <p className={cn(
                  "text-sm font-medium",
                  budgetRemaining < 0 ? "text-red-600" : "text-green-600"
                )}>
                  {budgetRemaining < 0 ? "Over budget by " : "Budget remaining: "}
                  ${Math.abs(budgetRemaining).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500 mb-1">Start Date</p>
                <p className="text-sm text-slate-700">
                  {new Date(project.startDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500 mb-1">Deadline</p>
                <p className={cn(
                  "text-sm font-medium",
                  isOverdue ? "text-red-600" : "text-slate-700"
                )}>
                  {new Date(project.deadline).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {isOverdue && " (Overdue)"}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500 mb-1">Team Members</p>
              <p className="text-sm text-slate-700">{project.teamMembers.length} members assigned</p>
            </div>
          </div>
        </div>
      </div>

      {/* Task Summary */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Task Summary</h2>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {tasksByStatus.map((status) => (
            <div
              key={status.value}
              className="rounded-lg bg-white border border-slate-200 p-4"
            >
              <p className="text-xs text-slate-600 font-medium mb-2">{status.label}</p>
              <p className="text-3xl font-bold text-slate-900">{status.count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Time & Activity Summary */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Time & Activity</h2>

        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
            <Clock className="h-6 w-6 text-slate-400" />
            <div>
              <p className="text-sm text-slate-600 font-medium">Total Hours Logged</p>
              <p className="text-2xl font-bold text-slate-900">{totalHours.toFixed(1)}h</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
            <TrendingUp className="h-6 w-6 text-slate-400" />
            <div>
              <p className="text-sm text-slate-600 font-medium">Cost per Hour</p>
              <p className="text-2xl font-bold text-slate-900">
                ${totalHours > 0 ? (project.spent / totalHours).toFixed(2) : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Time logs summary table */}
        {timeLogs.length === 0 ? (
          <p className="text-sm text-slate-500">No time logs recorded yet.</p>
        ) : (
          <div>
            <p className="text-sm font-medium text-slate-700 mb-3">Top Contributors</p>
            <div className="space-y-2">
              {Array.from(
                timeLogs.reduce((acc, log) => {
                  const employee = log.employeeName;
                  if (!acc.has(employee)) {
                    acc.set(employee, 0);
                  }
                  acc.set(employee, acc.get(employee)! + log.minutes);
                  return acc;
                }, new Map<string, number>())
              )
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([employee, minutes]) => (
                  <div key={employee} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded">
                    <span className="text-sm text-slate-700">{employee}</span>
                    <span className="text-sm font-medium text-slate-900">{(minutes / 60).toFixed(1)}h</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent Activity Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Recent Time Logs</h2>

        {timeLogs.length === 0 ? (
          <p className="text-sm text-slate-500">No time logs recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Task</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Hours</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {timeLogs
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 10)
                  .map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        {new Date(log.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{log.employeeName}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {tasks.find((t) => t.id === log.taskId)?.title || "—"}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {(log.minutes / 60).toFixed(1)}h
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {log.description || "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
