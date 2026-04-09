"use client";

import { useState, useEffect, FormEvent } from "react";
import { Loader2, Plus, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InvoiceBillingType, InvoiceLineItem, AppUser } from "@/types";

interface LineItem {
  description: string;
  quantity: number;
  unitRate: number;
  amount: number;
}

export default function InvoiceGenerateForm() {
  const [employees, setEmployees] = useState<AppUser[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [billingType, setBillingType] = useState<InvoiceBillingType>("monthly");
  const [periodLabel, setPeriodLabel] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [projectName, setProjectName] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitRate: 0, amount: 0 },
  ]);
  const [tax, setTax] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [forceRegenerate, setForceRegenerate] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch employees on mount
  useEffect(() => {
    async function fetchEmployees() {
      try {
        const res = await fetch("/api/employees");
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setEmployees(json.data);
        }
      } catch {
        console.error("Failed to fetch employees");
      } finally {
        setLoadingEmployees(false);
      }
    }
    fetchEmployees();
  }, []);

  // Calculate line item amounts
  function updateLineItem(idx: number, field: string, value: unknown) {
    setLineItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[idx] };

      if (field === "description") {
        item.description = value as string;
      } else if (field === "quantity") {
        item.quantity = Number(value) || 0;
      } else if (field === "unitRate") {
        item.unitRate = Number(value) || 0;
      }

      item.amount = item.quantity * item.unitRate;
      updated[idx] = item;
      return updated;
    });
  }

  function addLineItem() {
    setLineItems((prev) => [
      ...prev,
      { description: "", quantity: 1, unitRate: 0, amount: 0 },
    ]);
  }

  function removeLineItem(idx: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = (subtotal * tax) / 100;
  const total = subtotal + taxAmount - discount;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Validation
    if (!selectedEmployeeId) {
      setError("Please select an employee.");
      return;
    }
    if (!periodLabel.trim()) {
      setError("Period label is required.");
      return;
    }
    if (!periodStart || !periodEnd) {
      setError("Period start and end dates are required.");
      return;
    }
    if (billingType === "project-based") {
      if (!projectName.trim()) {
        setError("Project name is required for project-based invoices.");
        return;
      }
      if (
        lineItems.length === 0 ||
        lineItems.some((item) => !item.description.trim() || item.amount === 0)
      ) {
        setError("All line items must have a description and amount.");
        return;
      }
    }

    setLoading(true);

    try {
      const payload = {
        userId: selectedEmployeeId,
        billingType,
        periodLabel,
        periodStart,
        periodEnd,
        projectId: billingType === "project-based" ? projectName : null,
        projectName: billingType === "project-based" ? projectName : null,
        lineItems:
          billingType === "project-based"
            ? lineItems.map((item) => ({
                description: item.description,
                quantity: item.quantity,
                unitRate: item.unitRate,
                amount: item.amount,
              }))
            : [],
        tax,
        discount,
        notes: notes.trim() || null,
        forceRegenerate,
      };

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Failed to generate invoice.");
        return;
      }

      setSuccess(true);
      // Reset form
      setTimeout(() => {
        setSelectedEmployeeId("");
        setBillingType("monthly");
        setPeriodLabel("");
        setPeriodStart("");
        setPeriodEnd("");
        setProjectName("");
        setLineItems([{ description: "", quantity: 1, unitRate: 0, amount: 0 }]);
        setTax(0);
        setDiscount(0);
        setNotes("");
        setForceRegenerate(false);
        setSuccess(false);
      }, 2000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-600" />
        <p className="font-semibold text-green-900">Invoice Generated Successfully</p>
        <p className="mt-1 text-sm text-green-700">
          The invoice has been created and is ready for use.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error message */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Employee Selection */}
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-2">
          Employee *
        </label>
        <select
          value={selectedEmployeeId}
          onChange={(e) => setSelectedEmployeeId(e.target.value)}
          disabled={loadingEmployees}
          className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
        >
          <option value="">
            {loadingEmployees ? "Loading employees..." : "Select an employee"}
          </option>
          {employees.map((emp) => (
            <option key={emp.uid} value={emp.uid}>
              {emp.displayName} ({emp.email})
            </option>
          ))}
        </select>
      </div>

      {/* Billing Type */}
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-2">
          Billing Type *
        </label>
        <select
          value={billingType}
          onChange={(e) => setBillingType(e.target.value as InvoiceBillingType)}
          className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="hourly">Hourly</option>
          <option value="weekly">Weekly</option>
          <option value="bi-weekly">Bi-weekly</option>
          <option value="monthly">Monthly</option>
          <option value="project-based">Project-based</option>
        </select>
      </div>

      {/* Period Information */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Period Label *
          </label>
          <input
            type="text"
            placeholder="e.g. 2026-W15 or 2026-04"
            value={periodLabel}
            onChange={(e) => setPeriodLabel(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Period Start *
          </label>
          <input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Period End *
          </label>
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Project Name (only for project-based) */}
      {billingType === "project-based" && (
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Project Name *
          </label>
          <input
            type="text"
            placeholder="e.g. Website Redesign"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      )}

      {/* Line Items (only for project-based) */}
      {billingType === "project-based" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-semibold text-slate-900">
              Line Items *
            </label>
            <button
              type="button"
              onClick={addLineItem}
              className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              <Plus className="h-4 w-4" />
              Add Item
            </button>
          </div>

          <div className="space-y-3">
            {lineItems.map((item, idx) => (
              <div key={idx} className="flex gap-3 items-end">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) =>
                      updateLineItem(idx, "description", e.target.value)
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div className="w-20">
                  <input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) =>
                      updateLineItem(idx, "quantity", e.target.value)
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div className="w-24">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Rate"
                    value={item.unitRate}
                    onChange={(e) =>
                      updateLineItem(idx, "unitRate", e.target.value)
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div className="w-24 text-right">
                  <p className="text-sm font-semibold text-slate-900">
                    ${item.amount.toFixed(2)}
                  </p>
                </div>
                {lineItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLineItem(idx)}
                    className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tax & Discount */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Tax (%)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={tax}
            onChange={(e) => setTax(Number(e.target.value) || 0)}
            className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Discount ($)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value) || 0)}
            className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Invoice Summary */}
      <div className="rounded-lg bg-slate-50 p-4 space-y-2 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>Subtotal:</span>
          <span className="font-semibold">${subtotal.toFixed(2)}</span>
        </div>
        {taxAmount > 0 && (
          <div className="flex justify-between text-slate-600">
            <span>Tax ({tax}%):</span>
            <span className="font-semibold">${taxAmount.toFixed(2)}</span>
          </div>
        )}
        {discount > 0 && (
          <div className="flex justify-between text-slate-600">
            <span>Discount:</span>
            <span className="font-semibold">-${discount.toFixed(2)}</span>
          </div>
        )}
        <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-900">
          <span>Total:</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-2">
          Notes
        </label>
        <textarea
          placeholder="Additional notes or terms..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Force Regenerate */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="forceRegen"
          checked={forceRegenerate}
          onChange={(e) => setForceRegenerate(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <label htmlFor="forceRegen" className="text-sm text-slate-600">
          Force regenerate if invoice already exists
        </label>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Generating..." : "Generate Invoice"}
      </button>
    </form>
  );
}
