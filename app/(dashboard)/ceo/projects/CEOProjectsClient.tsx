"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FolderKanban,
  Search,
  Filter,
  Calendar,
  Users,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project, ProjectStatus } from "@/types";
import { PROJECT_STATUSES } from "@/types";

export default function CEOProjectsClient() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/projects");
      const json = await res.json();
      if (json.success) setProjects(json.data);
    } catch {
      setError("Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const filtered = projects.filter((p) => {
    const matchStatus =
      statusFilter === "all" || p.status === statusFilter;
    const matchSearch =
      searchQuery === "" ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.clientName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  const getStatusColor = (status: ProjectStatus) => {
    const statusObj = PROJECT_STATUSES.find((s) => s.value === status);
    return statusObj?.color || "bg-slate-100 text-slate-700";
  };

  const isOverdue = (deadline: string) => {
    return new Date(deadline) < new Date() && deadline;
  };

  // Calculate summary stats
  const totalBudget = projects.reduce((sum, p) => sum + p.budget, 0);
  const totalSpent = projects.reduce((sum, p) => sum + p.spent, 0);
  const activeProjects = projects.filter((p) => p.status === "active").length;

  return (
    <div className="space-y-4">
      {/* Error toast */}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <FolderKanban className="h-6 w-6" />
          Projects Overview
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          View all company projects and performance
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500 mb-1">Active Projects</p>
          <p className="text-2xl font-bold text-slate-900">{activeProjects}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500 mb-1">Total Budget</p>
          <p className="text-2xl font-bold text-slate-900">${totalBudget.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500 mb-1">Total Spent</p>
          <p className="text-2xl font-bold text-slate-900">${totalSpent.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search projects…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | "all")}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="all">All Statuses</option>
          {PROJECT_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <p className="text-xs text-slate-500">
        {filtered.length} of {projects.length} project{projects.length !== 1 ? "s" : ""}
      </p>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center text-sm text-slate-400">
          {searchQuery || statusFilter !== "all"
            ? "No projects match your filters."
            : "No projects found."}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {filtered.map((project) => (
            <div
              key={project.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Header */}
              <div className="mb-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {project.name}
                    </h3>
                    <p className="text-sm text-slate-500">{project.clientName}</p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
                      getStatusColor(project.status)
                    )}
                  >
                    {PROJECT_STATUSES.find((s) => s.value === project.status)
                      ?.label}
                  </span>
                </div>
                {project.serviceType && (
                  <p className="text-xs inline-flex items-center gap-1 bg-slate-100 text-slate-600 rounded px-2 py-1 mt-1">
                    {project.serviceType}
                  </p>
                )}
              </div>

              {/* Budget */}
              <div className="mb-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Budget Utilization</span>
                  <span className="font-medium text-slate-900">
                    {((project.spent / project.budget) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-colors",
                      (project.spent / project.budget) > 0.9
                        ? "bg-red-500"
                        : (project.spent / project.budget) > 0.7
                        ? "bg-yellow-500"
                        : "bg-green-500"
                    )}
                    style={{
                      width: `${Math.min((project.spent / project.budget) * 100, 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  ${project.spent.toLocaleString()} of ${project.budget.toLocaleString()}
                </p>
              </div>

              {/* Deadline & Team */}
              <div className="mb-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {new Date(project.deadline).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  {isOverdue(project.deadline) && (
                    <span className="text-xs font-medium text-red-600">
                      Overdue
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Users className="h-4 w-4" />
                  <span>
                    {project.teamMembers.length} team members | Manager: {project.managerName}
                  </span>
                </div>
              </div>

              {/* View Details button */}
              <Link
                href={`/ceo/projects/${project.id}`}
                className="w-full rounded-lg bg-slate-100 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors block"
              >
                View Details
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
