/**
 * app/(dashboard)/admin/clients/AdminClientsClient.tsx
 *
 * Full client management page:
 *  - Search by company name, contact, email
 *  - Filter by status (lead, active, paused, churned)
 *  - Add Client modal
 *  - Edit Client modal
 *  - Delete with confirmation
 *  - Link to client detail page
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Building2,
  Mail,
  Plus,
  Search,
  Edit2,
  Trash2,
  ExternalLink,
  Loader2,
  X,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Client, ClientStatus } from "@/types";
import { CLIENT_STATUSES } from "@/types";

const STATUS_COLORS: Record<ClientStatus, string> = {
  lead:    "bg-gray-100 text-gray-800",
  active:  "bg-green-100 text-green-800",
  paused:  "bg-yellow-100 text-yellow-800",
  churned: "bg-red-100 text-red-800",
};

type ModalMode = "add" | "edit" | null;

const EMPTY_FORM = {
  companyName:    "",
  contactName:    "",
  contactEmail:   "",
  contactPhone:   "",
  website:        "",
  industry:       "",
  address:        "",
  status:         "lead" as ClientStatus,
  billingType:    "retainer" as "retainer" | "project-based" | "hourly",
  monthlyRetainer: "",
  notes:          "",
};

export default function AdminClientsClient() {
  const [clients, setClients]         = useState<Client[]>([]);
  const [loading, setLoading]         = useState(true);
  const [query, setQuery]             = useState("");
  const [statusFilter, setStatusFilter] = useState<ClientStatus | "all">("all");
  const [modal, setModal]             = useState<ModalMode>(null);
  const [editing, setEditing]         = useState<Client | null>(null);
  const [form, setForm]               = useState({ ...EMPTY_FORM });
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Client | null>(null);
  const [deleting, setDeleting]       = useState(false);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/clients");
      const json = await res.json();
      if (json.success) setClients(json.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const filtered = clients.filter((c) => {
    const q = query.toLowerCase();
    const matchesQuery =
      c.companyName.toLowerCase().includes(q) ||
      c.contactName.toLowerCase().includes(q) ||
      c.contactEmail.toLowerCase().includes(q);

    const matchesStatus = statusFilter === "all" || c.status === statusFilter;

    return matchesQuery && matchesStatus;
  });

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setError(null);
    setModal("add");
  }

  function openEdit(client: Client) {
    setEditing(client);
    setForm({
      companyName:    client.companyName,
      contactName:    client.contactName,
      contactEmail:   client.contactEmail,
      contactPhone:   client.contactPhone ?? "",
      website:        client.website ?? "",
      industry:       client.industry ?? "",
      address:        client.address ?? "",
      status:         client.status,
      billingType:    client.billingType,
      monthlyRetainer: client.monthlyRetainer?.toString() ?? "",
      notes:          client.notes ?? "",
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
    if (!form.companyName.trim() || !form.contactName.trim() || !form.contactEmail.trim()) {
      setError("Company name, contact name, and email are required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        companyName:    form.companyName.trim(),
        contactName:    form.contactName.trim(),
        contactEmail:   form.contactEmail.trim(),
        contactPhone:   form.contactPhone.trim() || undefined,
        website:        form.website.trim() || undefined,
        industry:       form.industry.trim() || undefined,
        address:        form.address.trim() || undefined,
        status:         form.status,
        billingType:    form.billingType,
        monthlyRetainer: form.billingType === "retainer" && form.monthlyRetainer
          ? parseFloat(form.monthlyRetainer)
          : undefined,
        notes:          form.notes.trim() || undefined,
        ...(modal === "edit" && editing ? { id: editing.id } : {}),
      };

      const res  = await fetch("/api/clients", {
        method:  modal === "add" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.error ?? "Operation failed.");
        return;
      }

      setSuccess(modal === "add" ? "Client added." : "Client updated.");
      closeModal();
      await fetchClients();
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
      const res  = await fetch("/api/clients", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id: confirmDelete.id }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.error ?? "Failed to delete client.");
        setConfirmDelete(null);
        setDeleting(false);
        return;
      }

      setSuccess(`${confirmDelete.companyName} has been deleted.`);
      setConfirmDelete(null);
      await fetchClients();
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

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Add Client
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ClientStatus | "all")}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="all">All Statuses</option>
          {CLIENT_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search company, contact, email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Stats */}
      <p className="text-xs text-slate-500">
        {filtered.length} of {clients.length} client{clients.length !== 1 ? "s" : ""}
      </p>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center text-sm text-slate-400">
          {query ? "No clients match your search." : "No clients found. Add your first client."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Company Name", "Contact", "Email", "Status", "Billing Type", "Monthly Retainer", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((client) => (
                <tr key={client.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                        {client.companyName.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-900">{client.companyName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{client.contactName}</td>
                  <td className="px-4 py-3 text-slate-500">{client.contactEmail}</td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_COLORS[client.status])}>
                      {client.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{client.billingType}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">
                    {client.monthlyRetainer != null
                      ? `$${client.monthlyRetainer.toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                        title="View details"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => openEdit(client)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(client)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete client"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {modal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={closeModal} />
          <div className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                {modal === "add" ? "Add Client" : "Edit Client"}
              </h3>
              <button onClick={closeModal} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
              {/* Company Name */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Company Name<span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  value={form.companyName}
                  onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                  className="input"
                  placeholder="Acme Corp"
                />
              </div>

              {/* Contact Name */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Contact Name<span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  value={form.contactName}
                  onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                  className="input"
                  placeholder="John Smith"
                />
              </div>

              {/* Contact Email */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Contact Email<span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                  className="input"
                  placeholder="john@acme.com"
                />
              </div>

              {/* Contact Phone */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Contact Phone</label>
                <input
                  type="tel"
                  value={form.contactPhone}
                  onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                  className="input"
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              {/* Website */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Website</label>
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                  className="input"
                  placeholder="https://example.com"
                />
              </div>

              {/* Industry */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Industry</label>
                <input
                  type="text"
                  value={form.industry}
                  onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
                  className="input"
                  placeholder="Technology, Retail, etc."
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="input resize-none"
                  placeholder="123 Main St, City, State 12345"
                  rows={2}
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ClientStatus }))}
                  className="input"
                >
                  {CLIENT_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Billing Type */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Billing Type</label>
                <select
                  value={form.billingType}
                  onChange={(e) => setForm((f) => ({ ...f, billingType: e.target.value as "retainer" | "project-based" | "hourly" }))}
                  className="input"
                >
                  <option value="retainer">Retainer</option>
                  <option value="project-based">Project-based</option>
                  <option value="hourly">Hourly</option>
                </select>
              </div>

              {/* Monthly Retainer (conditional) */}
              {form.billingType === "retainer" && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Monthly Retainer ($)
                  </label>
                  <input
                    type="number"
                    value={form.monthlyRetainer}
                    onChange={(e) => setForm((f) => ({ ...f, monthlyRetainer: e.target.value }))}
                    className="input"
                    step="0.01"
                    min="0"
                    placeholder="5000.00"
                  />
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="input resize-none"
                  placeholder="Additional notes…"
                  rows={2}
                />
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button onClick={closeModal} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {modal === "add" ? "Add Client" : "Save Changes"}
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
              <h3 className="text-base font-semibold text-slate-900">Delete Client</h3>
              <p className="mt-2 text-sm text-slate-500">
                Are you sure you want to permanently delete{" "}
                <span className="font-medium text-slate-900">{confirmDelete.companyName}</span>?
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
