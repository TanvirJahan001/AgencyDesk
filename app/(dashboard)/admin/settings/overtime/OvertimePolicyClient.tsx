"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Edit, Trash2, Loader2, X, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OvertimePolicy } from "@/types";

export default function OvertimePolicyClient() {
  const [policies, setPolicies] = useState<OvertimePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    weeklyThresholdMinutes: 2400,
    dailyThresholdMinutes: 480,
    regularMultiplier: 1.0,
    overtimeMultiplier: 1.5,
    weekendMultiplier: 2.0,
    holidayMultiplier: 2.5,
    isDefault: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPolicies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/overtime");
      const json = await res.json();
      if (json.success) {
        setPolicies(json.data || []);
      } else {
        setError(json.error || "Failed to load overtime policies");
      }
    } catch (err) {
      setError("Failed to load overtime policies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  const handleOpenModal = (policy?: OvertimePolicy) => {
    if (policy) {
      setEditingId(policy.id);
      setForm({
        name: policy.name,
        weeklyThresholdMinutes: policy.weeklyThresholdMinutes,
        dailyThresholdMinutes: policy.dailyThresholdMinutes ?? 480,
        regularMultiplier: policy.regularMultiplier,
        overtimeMultiplier: policy.overtimeMultiplier,
        weekendMultiplier: policy.weekendMultiplier ?? 2.0,
        holidayMultiplier: policy.holidayMultiplier ?? 2.5,
        isDefault: policy.isDefault,
      });
    } else {
      setEditingId(null);
      setForm({
        name: "",
        weeklyThresholdMinutes: 2400,
        dailyThresholdMinutes: 480,
        regularMultiplier: 1.0,
        overtimeMultiplier: 1.5,
        weekendMultiplier: 2.0,
        holidayMultiplier: 2.5,
        isDefault: false,
      });
    }
    setError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("Please enter a policy name");
      return;
    }

    if (form.overtimeMultiplier <= 0) {
      setError("Overtime multiplier must be greater than 0");
      return;
    }

    setSaving(true);
    try {
      const method = editingId ? "PATCH" : "POST";
      const body = editingId
        ? { id: editingId, ...form }
        : form;

      const res = await fetch("/api/settings/overtime", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.error || "Operation failed");
        return;
      }

      setSuccess(
        editingId
          ? "Overtime policy updated successfully"
          : "Overtime policy created successfully"
      );
      setModalOpen(false);
      setEditingId(null);
      await fetchPolicies();
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/overtime", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isDefault: true }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.error || "Failed to set as default");
        return;
      }

      setSuccess("Default policy updated successfully");
      await fetchPolicies();
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/settings/overtime?id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.error || "Failed to delete policy");
        return;
      }

      setSuccess("Overtime policy deleted successfully");
      setDeleteConfirm(null);
      await fetchPolicies();
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const minutesToHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div className="space-y-6">
      {success && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800 flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Overtime Policies</h1>
        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          New Policy
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : policies.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-12 text-center">
          <p className="text-slate-600">No overtime policies yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {policies.map((policy) => (
            <div
              key={policy.id}
              className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-slate-900">{policy.name}</h3>
                  {policy.isDefault && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                      <Star className="h-3 w-3" />
                      Default
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenModal(policy)}
                    className="rounded p-2 hover:bg-slate-100 text-slate-600 hover:text-slate-900"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  {!policy.isDefault && (
                    <button
                      onClick={() => setDeleteConfirm(policy.id)}
                      className="rounded p-2 hover:bg-red-50 text-slate-600 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase">Weekly Threshold</p>
                    <p className="text-sm font-semibold text-slate-900 mt-1">
                      {minutesToHours(policy.weeklyThresholdMinutes)}
                    </p>
                  </div>
                  {policy.dailyThresholdMinutes && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase">Daily Threshold</p>
                      <p className="text-sm font-semibold text-slate-900 mt-1">
                        {minutesToHours(policy.dailyThresholdMinutes)}
                      </p>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200 pt-3">
                  <p className="text-xs font-medium text-slate-500 uppercase mb-2">Pay Multipliers</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center justify-between rounded bg-slate-50 px-2 py-1">
                      <span className="text-slate-600">Regular</span>
                      <span className="font-semibold text-slate-900">{policy.regularMultiplier}x</span>
                    </div>
                    <div className="flex items-center justify-between rounded bg-slate-50 px-2 py-1">
                      <span className="text-slate-600">Overtime</span>
                      <span className="font-semibold text-slate-900">{policy.overtimeMultiplier}x</span>
                    </div>
                    {policy.weekendMultiplier && (
                      <div className="flex items-center justify-between rounded bg-slate-50 px-2 py-1">
                        <span className="text-slate-600">Weekend</span>
                        <span className="font-semibold text-slate-900">{policy.weekendMultiplier}x</span>
                      </div>
                    )}
                    {policy.holidayMultiplier && (
                      <div className="flex items-center justify-between rounded bg-slate-50 px-2 py-1">
                        <span className="text-slate-600">Holiday</span>
                        <span className="font-semibold text-slate-900">{policy.holidayMultiplier}x</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer actions */}
              {!policy.isDefault && (
                <button
                  onClick={() => handleSetDefault(policy.id)}
                  disabled={saving}
                  className="mt-4 w-full rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Set as Default"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingId ? "Edit Overtime Policy" : "New Overtime Policy"}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded p-1 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Policy Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Standard, Senior, Weekend"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Weekly Threshold (minutes)
                  </label>
                  <input
                    type="number"
                    value={form.weeklyThresholdMinutes}
                    onChange={(e) => setForm({ ...form, weeklyThresholdMinutes: Number(e.target.value) })}
                    min="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 mt-1">{minutesToHours(form.weeklyThresholdMinutes)}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Daily Threshold (minutes)
                  </label>
                  <input
                    type="number"
                    value={form.dailyThresholdMinutes}
                    onChange={(e) => setForm({ ...form, dailyThresholdMinutes: Number(e.target.value) })}
                    min="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 mt-1">{minutesToHours(form.dailyThresholdMinutes)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Regular Multiplier
                  </label>
                  <input
                    type="number"
                    value={form.regularMultiplier}
                    onChange={(e) => setForm({ ...form, regularMultiplier: Number(e.target.value) })}
                    step="0.1"
                    min="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Overtime Multiplier
                  </label>
                  <input
                    type="number"
                    value={form.overtimeMultiplier}
                    onChange={(e) => setForm({ ...form, overtimeMultiplier: Number(e.target.value) })}
                    step="0.1"
                    min="0"
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Weekend Multiplier
                  </label>
                  <input
                    type="number"
                    value={form.weekendMultiplier}
                    onChange={(e) => setForm({ ...form, weekendMultiplier: Number(e.target.value) })}
                    step="0.1"
                    min="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Holiday Multiplier
                  </label>
                  <input
                    type="number"
                    value={form.holidayMultiplier}
                    onChange={(e) => setForm({ ...form, holidayMultiplier: Number(e.target.value) })}
                    step="0.1"
                    min="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                  className="rounded border-slate-300"
                />
                <span className="text-sm font-medium text-slate-700">Set as default policy</span>
              </label>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingId ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-sm w-full">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Delete Policy?</h2>
              <p className="text-sm text-slate-600 mb-6">
                This action cannot be undone. The policy will be permanently deleted.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  disabled={deleting}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
