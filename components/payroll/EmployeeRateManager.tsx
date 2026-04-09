/**
 * components/payroll/EmployeeRateManager.tsx
 *
 * Admin component for viewing and editing employee hourly rates,
 * overtime multipliers, and weekly OT thresholds.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import type { AppUser } from "@/types";
import {
  fmtRate,
  DEFAULT_HOURLY_RATE,
  DEFAULT_OT_MULTIPLIER,
  DEFAULT_WEEKLY_OT_THRESHOLD_MIN,
  minToHours,
} from "@/lib/payroll/utils";
import { cn } from "@/lib/utils";
import { DollarSign, Save, X } from "lucide-react";

export default function EmployeeRateManager() {
  const [employees, setEmployees] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ hourlyRate: 0, overtimeMultiplier: 1.5, weeklyOvertimeThresholdMin: 2400 });
  const [saving, setSaving] = useState(false);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payroll/rates");
      const data = await res.json();
      if (data.success) setEmployees(data.data);
      else setError(data.error);
    } catch {
      setError("Failed to load employees.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  function startEdit(emp: AppUser) {
    setEditingId(emp.uid);
    setEditValues({
      hourlyRate: emp.hourlyRate ?? DEFAULT_HOURLY_RATE,
      overtimeMultiplier: emp.overtimeMultiplier ?? DEFAULT_OT_MULTIPLIER,
      weeklyOvertimeThresholdMin: emp.weeklyOvertimeThresholdMin ?? DEFAULT_WEEKLY_OT_THRESHOLD_MIN,
    });
  }

  async function handleSave(employeeId: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/payroll/rates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, ...editValues }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setEditingId(null);
      await fetchEmployees();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-gray-100 px-5 py-4">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-brand-600" />
          Employee Rate Configuration
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          Set hourly rates and overtime rules. These rates are snapshotted at payroll calculation time.
        </p>
      </div>

      {error && (
        <div className="mx-5 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60 text-left">
              <th className="px-5 py-2.5 font-medium text-gray-600">Employee</th>
              <th className="px-5 py-2.5 font-medium text-gray-600 text-right">Hourly Rate</th>
              <th className="px-5 py-2.5 font-medium text-gray-600 text-right">OT Multiplier</th>
              <th className="px-5 py-2.5 font-medium text-gray-600 text-right">OT Threshold</th>
              <th className="px-5 py-2.5 font-medium text-gray-600 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                  No employees found.
                </td>
              </tr>
            ) : (
              employees.map((emp) => {
                const isEditing = editingId === emp.uid;
                return (
                  <tr key={emp.uid} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{emp.displayName}</p>
                      <p className="text-xs text-gray-500">{emp.email}</p>
                    </td>

                    {isEditing ? (
                      <>
                        <td className="px-5 py-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editValues.hourlyRate}
                            onChange={(e) => setEditValues((v) => ({ ...v, hourlyRate: parseFloat(e.target.value) || 0 }))}
                            className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm"
                          />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <input
                            type="number"
                            step="0.1"
                            min="1"
                            value={editValues.overtimeMultiplier}
                            onChange={(e) => setEditValues((v) => ({ ...v, overtimeMultiplier: parseFloat(e.target.value) || 1 }))}
                            className="w-20 rounded border border-gray-300 px-2 py-1 text-right text-sm"
                          />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <input
                            type="number"
                            step="60"
                            min="0"
                            value={editValues.weeklyOvertimeThresholdMin}
                            onChange={(e) => setEditValues((v) => ({ ...v, weeklyOvertimeThresholdMin: parseInt(e.target.value) || 0 }))}
                            className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm"
                          />
                          <span className="ml-1 text-xs text-gray-400">
                            ({minToHours(editValues.weeklyOvertimeThresholdMin)}h)
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleSave(emp.uid)}
                              disabled={saving}
                              className="rounded-lg bg-green-50 p-1.5 text-green-700 hover:bg-green-100 disabled:opacity-50"
                              title="Save"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="rounded-lg bg-gray-100 p-1.5 text-gray-600 hover:bg-gray-200"
                              title="Cancel"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-5 py-3 text-right font-mono">
                          {emp.hourlyRate
                            ? fmtRate(emp.hourlyRate)
                            : <span className="text-gray-400">Not set</span>}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {(emp.overtimeMultiplier ?? DEFAULT_OT_MULTIPLIER)}x
                        </td>
                        <td className="px-5 py-3 text-right">
                          {minToHours(emp.weeklyOvertimeThresholdMin ?? DEFAULT_WEEKLY_OT_THRESHOLD_MIN)}h/wk
                        </td>
                        <td className="px-5 py-3 text-center">
                          <button
                            onClick={() => startEdit(emp)}
                            className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                          >
                            Edit
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
