/**
 * components/employees/AdminEmployeeList.tsx
 *
 * Full employee management list:
 *  - Search by name/email
 *  - Add Employee modal
 *  - Edit Employee modal
 *  - Deactivate / Activate toggle
 *  - Link to employee detail page
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  UserPlus,
  Search,
  Edit2,
  UserX,
  UserCheck,
  ExternalLink,
  Loader2,
  X,
  ChevronRight,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppUser, PayType } from "@/types";
import { DEPARTMENTS, POSITIONS, PAY_TYPES } from "@/types";

const ROLE_COLORS: Record<string, string> = {
  employee: "bg-green-100 text-green-800",
  admin:    "bg-blue-100 text-blue-800",
  ceo:      "bg-purple-100 text-purple-800",
};

type ModalMode = "add" | "edit" | null;

const EMPTY_FORM = {
  displayName:  "",
  email:        "",
  role:         "employee" as "employee" | "admin" | "ceo",
  department:   "",
  position:     "",
  payType:      "monthly" as PayType,
  salaryAmount: "",
  password:     "",
};

export default function AdminEmployeeList() {
  const [employees, setEmployees]   = useState<AppUser[]>([]);
  const [loading,   setLoading]     = useState(true);
  const [query,     setQuery]       = useState("");
  const [modal,     setModal]       = useState<ModalMode>(null);
  const [editing,   setEditing]     = useState<AppUser | null>(null);
  const [form,      setForm]        = useState({ ...EMPTY_FORM });
  const [saving,    setSaving]      = useState(false);
  const [error,     setError]       = useState<string | null>(null);
  const [success,   setSuccess]     = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AppUser | null>(null);
  const [deleting,  setDeleting]    = useState(false);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/employees");
      const json = await res.json();
      if (json.success) setEmployees(json.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const filtered = employees.filter((e) => {
    const q = query.toLowerCase();
    return (
      e.displayName.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      (e.department ?? "").toLowerCase().includes(q)
    );
  });

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setError(null);
    setModal("add");
  }

  function openEdit(emp: AppUser) {
    setEditing(emp);
    setForm({
      displayName:  emp.displayName,
      email:        emp.email,
      role:         emp.role as "employee" | "admin" | "ceo",
      department:   emp.department ?? "",
      position:     emp.position ?? "",
      payType:      emp.payType ?? "monthly",
      salaryAmount: emp.salaryAmount?.toString() ?? "",
      password:     "",
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
    if (!form.displayName.trim() || !form.email.trim()) {
      setError("Name and email are required.");
      return;
    }
    if (modal === "add" && form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        displayName:  form.displayName.trim(),
        email:        form.email.trim(),
        role:         form.role,
        department:   form.department || undefined,
        position:     form.position || undefined,
        payType:      form.payType,
        salaryAmount: form.salaryAmount ? parseFloat(form.salaryAmount) : undefined,
        ...(modal === "add" ? { password: form.password } : {}),
        ...(modal === "edit" && editing ? { uid: editing.uid } : {}),
      };

      const res  = await fetch("/api/employees", {
        method:  modal === "add" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.error ?? "Operation failed.");
        return;
      }

      setSuccess(modal === "add" ? "Employee added." : "Employee updated.");
      closeModal();
      await fetchEmployees();
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(emp: AppUser) {
    try {
      await fetch("/api/employees", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ uid: emp.uid, disabled: !(emp as { disabled?: boolean }).disabled }),
      });
      await fetchEmployees();
    } catch {
      // silent
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res  = await fetch("/api/employees", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ uid: confirmDelete.uid }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.error ?? "Failed to delete employee.");
        setConfirmDelete(null);
        setDeleting(false);
        return;
      }

      setSuccess(`${confirmDelete.displayName} has been deleted.`);
      setConfirmDelete(null);
      await fetchEmployees();
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Success toast */}
      {success && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search name, email, department…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <button
          onClick={openAdd}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <UserPlus className="h-4 w-4" />
          Add Employee
        </button>
      </div>

      {/* Stats */}
      <p className="text-xs text-slate-500">
        {filtered.length} of {employees.length} employee{employees.length !== 1 ? "s" : ""}
      </p>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center text-sm text-slate-400">
          {query ? "No employees match your search." : "No employees found. Add your first employee."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Name", "Email", "Role", "Department", "Salary", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((emp) => {
                const isDisabled = (emp as { disabled?: boolean }).disabled;
                return (
                  <tr key={emp.uid} className={cn("hover:bg-slate-50/60", isDisabled && "opacity-60")}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                          {emp.displayName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-900">{emp.displayName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{emp.email}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", ROLE_COLORS[emp.role] ?? "bg-slate-100 text-slate-700")}>
                        {emp.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{emp.department ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">
                      {emp.salaryAmount != null
                        ? `$${emp.salaryAmount.toLocaleString()}${emp.payType === "hourly" ? "/hr" : emp.payType === "weekly" ? "/wk" : emp.payType === "bi-weekly" ? "/2wk" : emp.payType === "monthly" ? "/mo" : emp.payType === "project-based" ? "/proj" : ""}`
                        : emp.hourlyRate != null ? `$${emp.hourlyRate.toFixed(2)}/hr` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                        isDisabled ? "bg-slate-100 text-slate-600" : "bg-green-100 text-green-800"
                      )}>
                        {isDisabled ? "Inactive" : "Active"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/admin/employees/${emp.uid}`}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                          title="View details"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => openEdit(emp)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleActive(emp)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-orange-600"
                          title={isDisabled ? "Activate" : "Deactivate"}
                        >
                          {isDisabled
                            ? <UserCheck className="h-4 w-4" />
                            : <UserX className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(emp)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete employee"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {modal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={closeModal} />
          <div className="fixed inset-x-4 top-4 bottom-4 z-50 mx-auto flex max-w-md flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                {modal === "add" ? "Add Employee" : "Edit Employee"}
              </h3>
              <button onClick={closeModal} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-3">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Full Name<span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  value={form.displayName}
                  onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                  className="input"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Email<span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="input"
                />
              </div>

              {/* Password (add mode only) */}
              {modal === "add" && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Password (min 8 chars)<span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className="input"
                  />
                </div>
              )}

              {/* Role */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as "employee" | "admin" | "ceo" }))}
                  className="input"
                >
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                  <option value="ceo">CEO</option>
                </select>
              </div>

              {/* Department */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Department</label>
                <select
                  value={form.department}
                  onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                  className="input"
                >
                  <option value="">— Select Department —</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Position */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Position</label>
                <select
                  value={form.position}
                  onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                  className="input"
                >
                  <option value="">— Select Position —</option>
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Pay Type */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Pay Type</label>
                <select
                  value={form.payType}
                  onChange={(e) => setForm((f) => ({ ...f, payType: e.target.value as PayType }))}
                  className="input"
                >
                  {PAY_TYPES.map((pt) => (
                    <option key={pt.value} value={pt.value}>{pt.label}</option>
                  ))}
                </select>
              </div>

              {/* Salary Amount */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Salary Amount ($)
                  <span className="ml-1 text-[10px] text-slate-400 font-normal">
                    {form.payType === "hourly" ? "per hour" : form.payType === "weekly" ? "per week" : form.payType === "bi-weekly" ? "per 2 weeks" : form.payType === "monthly" ? "per month" : "per project"}
                  </span>
                </label>
                <input
                  type="number"
                  value={form.salaryAmount}
                  onChange={(e) => setForm((f) => ({ ...f, salaryAmount: e.target.value }))}
                  className="input"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                />
              </div>
            </div>

            </div>{/* end overflow scroll area */}

            <div className="flex shrink-0 gap-2 border-t border-slate-100 px-6 py-4">
              <button onClick={closeModal} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {modal === "add" ? "Add Employee" : "Save Changes"}
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
              <h3 className="text-base font-semibold text-slate-900">Delete Employee</h3>
              <p className="mt-2 text-sm text-slate-500">
                Are you sure you want to permanently delete{" "}
                <span className="font-medium text-slate-900">{confirmDelete.displayName}</span>?
                This will remove their account from Firebase Auth and all their data from the database.
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
