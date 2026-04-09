"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Edit, Trash2, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaxBracket, DeductionTemplate } from "@/types";

export default function TaxSettingsClient() {
  const [brackets, setBrackets] = useState<TaxBracket[]>([]);
  const [deductions, setDeductions] = useState<DeductionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"brackets" | "deductions">("brackets");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"bracket" | "deduction">("bracket");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bracketForm, setBracketForm] = useState({
    name: "",
    brackets: [{ min: 0, max: null, rate: 0.1 }],
  });
  const [deductionForm, setDeductionForm] = useState({
    name: "",
    type: "fixed" as "fixed" | "percentage",
    amount: 0,
    isDefault: false,
    description: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "bracket" | "deduction"; id: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/tax");
      const json = await res.json();
      if (json.success) {
        setBrackets(json.data?.brackets || []);
        setDeductions(json.data?.deductions || []);
      } else {
        setError(json.error || "Failed to load tax settings");
      }
    } catch (err) {
      setError("Failed to load tax settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleOpenBracketModal = (bracket?: TaxBracket) => {
    setModalType("bracket");
    if (bracket) {
      setEditingId(bracket.id);
      setBracketForm({
        name: bracket.name,
        brackets: bracket.brackets,
      });
    } else {
      setEditingId(null);
      setBracketForm({
        name: "",
        brackets: [{ min: 0, max: null, rate: 0.1 }],
      });
    }
    setError(null);
    setModalOpen(true);
  };

  const handleOpenDeductionModal = (deduction?: DeductionTemplate) => {
    setModalType("deduction");
    if (deduction) {
      setEditingId(deduction.id);
      setDeductionForm({
        name: deduction.name,
        type: deduction.type,
        amount: deduction.amount,
        isDefault: deduction.isDefault,
        description: deduction.description || "",
      });
    } else {
      setEditingId(null);
      setDeductionForm({
        name: "",
        type: "fixed",
        amount: 0,
        isDefault: false,
        description: "",
      });
    }
    setError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (modalType === "bracket") {
      if (!bracketForm.name.trim() || bracketForm.brackets.length === 0) {
        setError("Please enter a bracket name and at least one bracket");
        return;
      }

      setSaving(true);
      try {
        const method = editingId ? "PATCH" : "POST";
        const body = editingId
          ? { type: "bracket", id: editingId, ...bracketForm }
          : { type: "bracket", ...bracketForm };

        const res = await fetch("/api/settings/tax", {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();

        if (!json.success) {
          setError(json.error || "Operation failed");
          setSaving(false);
          return;
        }

        setSuccess(
          editingId
            ? "Tax bracket updated successfully"
            : "Tax bracket created successfully"
        );
        setModalOpen(false);
        setEditingId(null);
        await fetchSettings();
        setTimeout(() => setSuccess(null), 3000);
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setSaving(false);
      }
    } else {
      if (!deductionForm.name.trim() || deductionForm.amount < 0) {
        setError("Please enter a name and valid amount");
        return;
      }

      setSaving(true);
      try {
        const method = editingId ? "PATCH" : "POST";
        const body = editingId
          ? { type: "deduction", id: editingId, name: deductionForm.name, deductionType: deductionForm.type, amount: deductionForm.amount, isDefault: deductionForm.isDefault, description: deductionForm.description }
          : { type: "deduction", name: deductionForm.name, deductionType: deductionForm.type, amount: deductionForm.amount, isDefault: deductionForm.isDefault, description: deductionForm.description };

        const res = await fetch("/api/settings/tax", {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();

        if (!json.success) {
          setError(json.error || "Operation failed");
          setSaving(false);
          return;
        }

        setSuccess(
          editingId
            ? "Deduction template updated successfully"
            : "Deduction template created successfully"
        );
        setModalOpen(false);
        setEditingId(null);
        await fetchSettings();
        setTimeout(() => setSuccess(null), 3000);
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setSaving(false);
      }
    }
  };

  const handleDelete = async (type: "bracket" | "deduction", id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/settings/tax?type=${type}&id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.error || "Failed to delete");
        setDeleting(false);
        return;
      }

      setSuccess(
        type === "bracket"
          ? "Tax bracket deleted successfully"
          : "Deduction template deleted successfully"
      );
      setDeleteConfirm(null);
      await fetchSettings();
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDeleting(false);
    }
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

      <h1 className="text-2xl font-bold text-slate-900">Tax & Deductions</h1>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("brackets")}
          className={cn(
            "px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "brackets"
              ? "border-brand-600 text-brand-600"
              : "border-transparent text-slate-600 hover:text-slate-900"
          )}
        >
          Tax Brackets
        </button>
        <button
          onClick={() => setActiveTab("deductions")}
          className={cn(
            "px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "deductions"
              ? "border-brand-600 text-brand-600"
              : "border-transparent text-slate-600 hover:text-slate-900"
          )}
        >
          Deductions
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : activeTab === "brackets" ? (
        /* Tax Brackets Tab */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Tax Brackets</h2>
            <button
              onClick={() => handleOpenBracketModal()}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" />
              New Bracket
            </button>
          </div>

          {brackets.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-12 text-center">
              <p className="text-slate-600">No tax brackets yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {brackets.map((bracket) => (
                <div key={bracket.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-slate-900">{bracket.name}</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenBracketModal(bracket)}
                        className="rounded p-2 hover:bg-slate-100"
                      >
                        <Edit className="h-4 w-4 text-slate-600" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ type: "bracket", id: bracket.id })}
                        className="rounded p-2 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </button>
                    </div>
                  </div>

                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="px-3 py-2 text-left font-medium text-slate-600">Range</th>
                        <th className="px-3 py-2 text-right font-medium text-slate-600">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bracket.brackets.map((b, idx) => (
                        <tr key={idx} className="border-b border-slate-100">
                          <td className="px-3 py-2 text-slate-900">
                            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(b.min)}
                            {b.max !== null && ` - ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(b.max)}`}
                            {b.max === null && "+"}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-900 font-semibold">
                            {(b.rate * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Deductions Tab */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Deduction Templates</h2>
            <button
              onClick={() => handleOpenDeductionModal()}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" />
              New Deduction
            </button>
          </div>

          {deductions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-12 text-center">
              <p className="text-slate-600">No deduction templates yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {deductions.map((deduction) => (
                <div key={deduction.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-900">{deduction.name}</h3>
                        {deduction.isDefault && (
                          <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <span>
                          {deduction.type === "fixed"
                            ? `$${deduction.amount.toFixed(2)}`
                            : `${(deduction.amount * 100).toFixed(1)}%`}
                        </span>
                        {deduction.description && (
                          <span className="text-slate-500">{deduction.description}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenDeductionModal(deduction)}
                        className="rounded p-2 hover:bg-slate-100"
                      >
                        <Edit className="h-4 w-4 text-slate-600" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ type: "deduction", id: deduction.id })}
                        className="rounded p-2 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                {modalType === "bracket"
                  ? editingId ? "Edit Tax Bracket" : "New Tax Bracket"
                  : editingId ? "Edit Deduction" : "New Deduction"}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded p-1 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {modalType === "bracket" ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Bracket Name
                    </label>
                    <input
                      type="text"
                      value={bracketForm.name}
                      onChange={(e) => setBracketForm({ ...bracketForm, name: e.target.value })}
                      placeholder="e.g. Standard Employee Tax"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-slate-700">
                        Tax Brackets
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setBracketForm({
                            ...bracketForm,
                            brackets: [
                              ...bracketForm.brackets,
                              { min: bracketForm.brackets[bracketForm.brackets.length - 1]?.max || 0, max: null, rate: 0.1 },
                            ],
                          });
                        }}
                        className="text-xs px-2 py-1 rounded bg-brand-50 text-brand-600 hover:bg-brand-100"
                      >
                        Add Bracket
                      </button>
                    </div>

                    <div className="space-y-3">
                      {bracketForm.brackets.map((b, idx) => (
                        <div key={idx} className="space-y-2 p-3 rounded border border-slate-200 bg-slate-50">
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-xs font-medium text-slate-600 block mb-1">
                                Min
                              </label>
                              <input
                                type="number"
                                value={b.min}
                                onChange={(e) => {
                                  const newBrackets = [...bracketForm.brackets];
                                  newBrackets[idx].min = Number(e.target.value);
                                  setBracketForm({ ...bracketForm, brackets: newBrackets });
                                }}
                                min="0"
                                className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-slate-600 block mb-1">
                                Max
                              </label>
                              <input
                                type="number"
                                value={b.max === null ? "" : b.max}
                                onChange={(e) => {
                                  const newBrackets = [...bracketForm.brackets];
                                  newBrackets[idx].max = e.target.value === "" ? null : Number(e.target.value);
                                  setBracketForm({ ...bracketForm, brackets: newBrackets });
                                }}
                                min="0"
                                placeholder="∞"
                                className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-slate-600 block mb-1">
                                Rate %
                              </label>
                              <input
                                type="number"
                                value={(b.rate * 100).toFixed(1)}
                                onChange={(e) => {
                                  const newBrackets = [...bracketForm.brackets];
                                  newBrackets[idx].rate = Number(e.target.value) / 100;
                                  setBracketForm({ ...bracketForm, brackets: newBrackets });
                                }}
                                step="0.1"
                                min="0"
                                max="100"
                                className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                              />
                            </div>
                          </div>
                          {bracketForm.brackets.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newBrackets = bracketForm.brackets.filter((_, i) => i !== idx);
                                setBracketForm({ ...bracketForm, brackets: newBrackets });
                              }}
                              className="text-xs text-red-600 hover:text-red-700"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Deduction Name
                    </label>
                    <input
                      type="text"
                      value={deductionForm.name}
                      onChange={(e) => setDeductionForm({ ...deductionForm, name: e.target.value })}
                      placeholder="e.g. Health Insurance, Provident Fund"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Type
                      </label>
                      <select
                        value={deductionForm.type}
                        onChange={(e) => setDeductionForm({ ...deductionForm, type: e.target.value as "fixed" | "percentage" })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      >
                        <option value="fixed">Fixed Amount</option>
                        <option value="percentage">Percentage</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        {deductionForm.type === "fixed" ? "Amount ($)" : "Amount (%)"}
                      </label>
                      <input
                        type="number"
                        value={deductionForm.amount}
                        onChange={(e) => setDeductionForm({ ...deductionForm, amount: Number(e.target.value) })}
                        step={deductionForm.type === "fixed" ? "0.01" : "0.01"}
                        min="0"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Description (optional)
                    </label>
                    <input
                      type="text"
                      value={deductionForm.description}
                      onChange={(e) => setDeductionForm({ ...deductionForm, description: e.target.value })}
                      placeholder="e.g. Monthly health insurance premium"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                  </div>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={deductionForm.isDefault}
                      onChange={(e) => setDeductionForm({ ...deductionForm, isDefault: e.target.checked })}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm font-medium text-slate-700">Auto-apply to new employees</span>
                  </label>
                </>
              )}

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
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Delete?</h2>
              <p className="text-sm text-slate-600 mb-6">
                This action cannot be undone. The item will be permanently deleted.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm.type, deleteConfirm.id)}
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
