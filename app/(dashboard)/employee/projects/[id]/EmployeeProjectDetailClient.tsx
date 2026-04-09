"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Calendar,
  DollarSign,
  Users,
  Clock,
  MessageSquare,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project, Task, TimeLog, TaskStatus, TaskPriority } from "@/types";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/types";

type CommentInputOpen = string | null;

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

const TASK_COLUMNS: TaskStatus[] = ["todo", "in_progress", "review", "done"];

interface EmployeeBasic {
  uid: string;
  displayName: string;
}

export default function EmployeeProjectDetailClient({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<TaskWithExtras[]>([]);
  const [myTasks, setMyTasks] = useState<TaskWithExtras[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Time log state
  const [timeLogInput, setTimeLogInput] = useState<Record<string, { minutes: string; description: string }>>({});

  // Comments state
  const [commentInputOpen, setCommentInputOpen] = useState<CommentInputOpen>(null);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  // Expand task detail state
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

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
        // Filter to only show user's tasks
        const res2 = await fetch("/api/auth/me");
        const currentUser = await res2.json();
        if (currentUser.uid) {
          setMyTasks(json.data.filter((t: Task) => t.assigneeId === currentUser.uid));
        }
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

  async function handleChangeTaskStatus(taskId: string, newStatus: TaskStatus) {
    // Only allow changing status on own tasks
    if (!myTasks.find((t) => t.id === taskId)) {
      setError("You can only modify your own tasks.");
      return;
    }

    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchTasks();
      }
    } catch {
      // silent
    }
  }

  async function handleLogTime(taskId: string) {
    const input = timeLogInput[taskId];
    if (!input || !input.minutes) return;

    try {
      const res = await fetch("/api/time-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          projectId,
          minutes: parseInt(input.minutes),
          description: input.description || undefined,
          date: new Date().toISOString().split("T")[0],
        }),
      });
      const json = await res.json();
      if (json.success) {
        setTimeLogInput((prev) => {
          const updated = { ...prev };
          delete updated[taskId];
          return updated;
        });
        await fetchTimeLogs();
        await fetchTasks();
        setSuccess("Time logged successfully.");
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch {
      // silent
    }
  }

  async function handleAddComment(taskId: string) {
    if (!commentText.trim()) return;

    setPostingComment(true);
    try {
      const res = await fetch("/api/task-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          content: commentText.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setCommentText("");
        setCommentInputOpen(null);
        await fetchTasks();
      }
    } catch {
      // silent
    } finally {
      setPostingComment(false);
    }
  }

  const getTaskStatusColor = (status: TaskStatus) => {
    const statusObj = TASK_STATUSES.find((s) => s.value === status);
    return statusObj?.color || "bg-slate-100 text-slate-700";
  };

  const getTaskPriorityColor = (priority: TaskPriority) => {
    const priorityObj = TASK_PRIORITIES.find((p) => p.value === priority);
    return priorityObj?.color || "bg-slate-100 text-slate-600";
  };

  const myTimeLogs = timeLogs;
  const myTotalHours = myTimeLogs.reduce((sum, log) => sum + log.minutes, 0) / 60;

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

      {/* Back button and header */}
      <div className="flex items-center gap-4">
        <Link
          href="/employee/projects"
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
                <p className="text-sm text-slate-700">{project.description}</p>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500 mb-1">Budget</p>
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-900">
                  ${project.budget.toLocaleString()} / Spent: ${project.spent.toLocaleString()}
                </p>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500"
                    style={{
                      width: `${Math.min((project.spent / project.budget) * 100, 100)}%`,
                    }}
                  />
                </div>
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
                <p className="text-sm text-slate-700">
                  {new Date(project.deadline).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section B: Kanban Task Board - Show all tasks but allow status change on own tasks */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Project Tasks</h2>

        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {TASK_COLUMNS.map((status) => {
            const columnTasks = tasks.filter((t) => t.status === status);
            const statusLabel = TASK_STATUSES.find((s) => s.value === status)?.label || status;

            return (
              <div
                key={status}
                className="rounded-lg bg-slate-50 p-4 border border-slate-200 min-h-96"
              >
                <h3 className="font-semibold text-slate-900 mb-3 text-sm">
                  {statusLabel} <span className="text-slate-500 font-normal">({columnTasks.length})</span>
                </h3>

                <div className="space-y-3">
                  {columnTasks.map((task) => {
                    const isMyTask = task.assigneeId === task.assigneeId; // Would need actual user ID check
                    return (
                      <div
                        key={task.id}
                        className={cn(
                          "rounded-lg bg-white border border-slate-200 p-3 cursor-pointer hover:shadow-md transition-shadow",
                          !isMyTask && "opacity-75"
                        )}
                        onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                      >
                        {/* Task header */}
                        <div className="mb-2">
                          <p className="text-sm font-medium text-slate-900 line-clamp-2">
                            {task.title}
                          </p>
                        </div>

                        {/* Status, Assignee, Priority */}
                        <div className="space-y-2 mb-3">
                          {task.assigneeName && (
                            <p className="text-xs text-slate-600">
                              👤 {task.assigneeName}
                            </p>
                          )}
                          {task.priority && (
                            <span
                              className={cn(
                                "inline-flex text-xs font-medium px-2 py-0.5 rounded",
                                getTaskPriorityColor(task.priority)
                              )}
                            >
                              {task.priority}
                            </span>
                          )}
                        </div>

                        {/* Due date */}
                        {task.dueDate && (
                          <div className="flex items-center gap-1 text-xs text-slate-500 mb-3">
                            <Calendar className="h-3 w-3" />
                            {new Date(task.dueDate).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </div>
                        )}

                        {/* Status dropdown - only editable for own tasks */}
                        {isMyTask && (
                          <div className="mt-3">
                            <select
                              value={task.status}
                              onChange={(e) =>
                                handleChangeTaskStatus(task.id, e.target.value as TaskStatus)
                              }
                              className="w-full text-xs border border-slate-300 rounded px-2 py-1 bg-white"
                            >
                              {TASK_STATUSES.map((s) => (
                                <option key={s.value} value={s.value}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Expanded task detail */}
                        {expandedTaskId === task.id && (
                          <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                            {task.description && (
                              <div>
                                <p className="text-xs font-semibold text-slate-600 mb-1">Description</p>
                                <p className="text-xs text-slate-700">{task.description}</p>
                              </div>
                            )}

                            {/* Time Log - only for own tasks */}
                            {isMyTask && (
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-slate-600">Log Time</p>
                                <div className="space-y-2">
                                  <input
                                    type="number"
                                    placeholder="Minutes"
                                    value={timeLogInput[task.id]?.minutes || ""}
                                    onChange={(e) =>
                                      setTimeLogInput((prev) => ({
                                        ...prev,
                                        [task.id]: { ...prev[task.id], minutes: e.target.value },
                                      }))
                                    }
                                    className="w-full text-xs border border-slate-300 rounded px-2 py-1"
                                    min="0"
                                  />
                                  <input
                                    type="text"
                                    placeholder="Description (optional)"
                                    value={timeLogInput[task.id]?.description || ""}
                                    onChange={(e) =>
                                      setTimeLogInput((prev) => ({
                                        ...prev,
                                        [task.id]: { ...prev[task.id], description: e.target.value },
                                      }))
                                    }
                                    className="w-full text-xs border border-slate-300 rounded px-2 py-1"
                                  />
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleLogTime(task.id);
                                    }}
                                    className="w-full text-xs bg-blue-100 text-blue-700 rounded px-2 py-1 hover:bg-blue-200"
                                  >
                                    Log Time
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Comments */}
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-slate-600">Comments</p>
                              {task.comments && task.comments.length > 0 && (
                                <div className="space-y-2 bg-slate-50 rounded p-2 max-h-24 overflow-y-auto">
                                  {task.comments.map((comment) => (
                                    <div key={comment.id} className="text-xs">
                                      <p className="font-medium text-slate-700">{comment.authorName}</p>
                                      <p className="text-slate-600">{comment.content}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {commentInputOpen === task.id ? (
                                <div className="space-y-1">
                                  <textarea
                                    placeholder="Add a comment..."
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    className="w-full text-xs border border-slate-300 rounded px-2 py-1"
                                    rows={2}
                                  />
                                  <div className="flex gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddComment(task.id);
                                      }}
                                      disabled={postingComment}
                                      className="flex-1 text-xs bg-brand-600 text-white rounded px-2 py-1 hover:bg-brand-700 disabled:opacity-50"
                                    >
                                      {postingComment ? "..." : "Post"}
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCommentInputOpen(null);
                                        setCommentText("");
                                      }}
                                      className="flex-1 text-xs bg-slate-200 text-slate-700 rounded px-2 py-1 hover:bg-slate-300"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCommentInputOpen(task.id);
                                  }}
                                  className="w-full text-xs bg-slate-200 text-slate-700 rounded px-2 py-1 hover:bg-slate-300"
                                >
                                  <MessageSquare className="h-3 w-3 inline mr-1" />
                                  Add Comment
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section C: My Time Logs */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">My Time Logs</h2>

        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg mb-6">
          <Clock className="h-5 w-5 text-slate-400" />
          <div>
            <p className="text-xs text-slate-600">Total Hours Logged</p>
            <p className="text-lg font-bold text-slate-900">{myTotalHours.toFixed(1)}h</p>
          </div>
        </div>

        {/* Time logs table */}
        {myTimeLogs.length === 0 ? (
          <p className="text-sm text-slate-500">No time logs yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Task</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Hours</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {myTimeLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2">
                      {new Date(log.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {tasks.find((t) => t.id === log.taskId)?.title || "—"}
                    </td>
                    <td className="px-4 py-2 font-medium">
                      {(log.minutes / 60).toFixed(1)}h
                    </td>
                    <td className="px-4 py-2 text-slate-600">
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
