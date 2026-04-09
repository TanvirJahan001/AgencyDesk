"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FolderKanban,
  Plus,
  Search,
  Filter,
  DollarSign,
  Users,
  Calendar,
  ArrowLeft,
  Edit,
  Trash2,
  Loader2,
  X,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project, Client, ProjectStatus } from "@/types";
import { PROJECT_STATUSES, SERVICE_TYPES } from "@/types";

type ModalMode = "add" | "edit" | null;

const EMPTY_FORM = {
  name: "",
  clientId: "",
  serviceType: "",
  status: "active" as ProjectStatus,
  description: "",
  budget: "",
  spent: "",
  startDate: "",
  deadline: "",
  managerId: "",
  teamMembers: [] as string[],
};

interface AppUser {
  uid: string;
  displayName: string;
  email: string;
  role: string;
}

export default function AdminProjectsClient() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [modal, setModal] = useState<ModalMode>(null);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch("/api/clients");
      const json = await res.json();
      if (json.success) setClients(json.data);
    } catch {
      // silent
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/employees");
      const json = await res.json();
      if (json.success) setEmployees(json.data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    fetchClients();
    fetchEmployees();
  }, [fetchProjects, fetchClients, fetchEmployees]);

  const filtered = projects.filter((p) => {
    const matchStatus =
      statusFilter === "all" || p.status === statusFilter;
    const matchClient =
      clientFilter === "all" || p.clientId === clientFilter;
    const matchSearch =
      searchQuery === "" ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.clientName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchClient && matchSearch;
  });

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setError(null);
    setModal("add");
  }

  function openEdit(project: Project) {
    setEditing(project);
    setForm({
      name: project.name,
      clientId: project.clientId,
      serviceType: project.serviceType,
      status: project.status,
      description: project.description || "",
      budget: project.budget.toString(),
      spent: project.spent.toString(),
      startDate: project.startDate,
      deadline: project.deadline,
      managerId: project.managerId,
      teamMembers: project.teamMembers,
    });
    setError(null);
    setModal("edit");
  }

  function closeModal() {
    setModal(null);
    setEditing(null);
    setError(null);
  }

  async function handleSave() {
    setError(null);
    if (!form.name.trim() || !form.clientId || !form.budget || !form.deadline || !form.managerId) {
      setError("Name, Client, Budget, Deadline, and Manager are required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        clientId: form.clientId,
        serviceType: form.serviceType || "Other",
        status: form.status,
        description: form.description || undefined,
        budget: parseFloat(form.budget),
        spent: parseFloat(form.spent) || 0,
        startDate: form.startDate,
        deadline: form.deadline,
        managerId: form.managerId,
        teamMembers: form.teamMembers,
        ...(modal === "edit" && editing ? { id: editing.id } : {}),
      };

      const res = await fetch("/api/projects", {
        method: modal === "add" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.error ?? "Operation failed.");
        return;
      }

      setSuccess(modal === "add" ? "Project created." : "Project updated.");
      closeModal();
      await fetchProjects();
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: confirmDelete.id }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.error ?? "Failed to delete project.");
        setConfirmDelete(null);
        setDeleting(false);
        return;
      }

      setSuccess(`${confirmDelete.name} has been deleted.`);
      setConfirmDelete(null);
      await fetchProjects();
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  const getStatusColor = (status: ProjectStatus) => {
    const statusObj = PROJECT_STATUSES.find((s) => s.value === status);
    return statusObj?.color || "bg-slate-100 text-slate-700";
  };

  const isOverdue = (deadline: string) => {
    return new Date(deadline) < new Date() && deadline;
  };

  return (
    <div className="space-y-4">
      {/* Success toast */}
      {success && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
        </div>
      )}

      {/* Error toast */}
      {error && !modal && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FolderKanban className="h-6 w-6" />
            Projects
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage marketing agency projects and track progress
          </p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Add Project
        </button>
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

        <div className="flex gap-2">
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

          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="all">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </select>
        </div>
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
          {searchQuery || statusFilter !== "all" || clientFilter !== "all"
            ? "No projects match your filters."
            : "No projects found. Add your first project."}
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
                  <span className="text-slate-600">Budget</span>
                  <span className="font-medium text-slate-900">
                    ${project.budget.toLocaleString()} / Spent: ${project.spent.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500"
                    style={{
                      width: `${Math.min((project.spent / project.budget) * 100, 100)}%`,
                    }}
                  />
                </div>
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
                  <span>{project.teamMembers.length} team members</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Link
                  href={`/admin/projects/${project.id}`}
                  className="flex-1 rounded-lg bg-slate-100 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  View Details
                </Link>
                <button
                  onClick={() => openEdit(project)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                  title="Edit"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setConfirmDelete(project)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={closeModal} />
          <div className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                {modal === "add" ? "Add Project" : "Edit Project"}
              </h3>
              <button
                onClick={closeModal}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-3">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Project Name<span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="Project name"
                />
              </div>

              {/* Client */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Client<span className="text-red-500 ml-0.5">*</span>
                </label>
                <select
                  value={form.clientId}
                  onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">— Select Client —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Service Type */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Service Type
                </label>
                <select
                  value={form.serviceType}
                  onChange={(e) => setForm((f) => ({ ...f, serviceType: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">— Select Service —</option>
                  {SERVICE_TYPES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ProjectStatus }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {PROJECT_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  rows={3}
                  placeholder="Project description"
                />
              </div>

              {/* Budget */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Budget ($)<span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="number"
                  value={form.budget}
                  onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Start Date<span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              {/* Deadline */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Deadline<span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              {/* Manager */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Manager<span className="text-red-500 ml-0.5">*</span>
                </label>
                <select
                  value={form.managerId}
                  onChange={(e) => setForm((f) => ({ ...f, managerId: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">— Select Manager —</option>
                  {employees.map((e) => (
                    <option key={e.uid} value={e.uid}>
                      {e.displayName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Team Members */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">
                  Team Members
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {employees.map((e) => (
                    <label
                      key={e.uid}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={form.teamMembers.includes(e.uid)}
                        onChange={(evt) => {
                          if (evt.target.checked) {
                            setForm((f) => ({
                              ...f,
                              teamMembers: [...f.teamMembers, e.uid],
                            }));
                          } else {
                            setForm((f) => ({
                              ...f,
                              teamMembers: f.teamMembers.filter((id) => id !== e.uid),
                            }));
                          }
                        }}
                        className="rounded border-slate-300"
                      />
                      <span className="text-slate-700">{e.displayName}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={closeModal}
                className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {modal === "add" ? "Create Project" : "Save Changes"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => !deleting && setConfirmDelete(null)} />
          <div className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-sm -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Delete Project</h3>
              <p className="mt-2 text-sm text-slate-500">
                Are you sure you want to permanently delete{" "}
                <span className="font-medium text-slate-900">{confirmDelete.name}</span>?
                This action cannot be undone.
              </p>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
