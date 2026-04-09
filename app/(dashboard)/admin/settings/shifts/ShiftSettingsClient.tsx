"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Trash2,
  Edit,
  Plus,
  Loader2,
  X,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShiftTemplate, EmployeeSchedule, AppUser } from "@/types";

const SHIFT_TYPE_OPTIONS = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "night", label: "Night" },
  { value: "split", label: "Split" },
  { value: "flexible", label: "Flexible" },
  { value: "custom", label: "Custom" },
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

export default function ShiftSettingsClient() {
  const [activeTab, setActiveTab] = useState<"templates" | "schedules">("templates");

  // Shift Templates State
  const [shifts, setShifts] = useState<ShiftTemplate[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(true);
  const [shiftsModalOpen, setShiftsModalOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [shiftForm, setShiftForm] = useState({
    name: "",
    type: "morning" as any,
    startTime: "09:00",
    endTime: "17:00",
    breakMinutes: 60,
    workDays: [1, 2, 3, 4, 5] as number[],
    color: "#3b82f6",
    isDefault: false,
  });
  const [shiftSaving, setShiftSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Employee Schedules State
  const [schedules, setSchedules] = useState<EmployeeSchedule[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(true);
  const [schedulesModalOpen, setSchedulesModalOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<AppUser[]>([]);
  const [scheduleForm, setScheduleForm] = useState({
    employeeId: "",
    shiftTemplateId: "",
    startDate: "",
    endDate: "",
  });
  const [scheduleSaving, setScheduleSaving] = useState(false);

  // ─── Fetch Shifts ───────────────────────────────────────────

  const fetchShifts = useCallback(async () => {
    setShiftsLoading(true);
    try {
      const res = await fetch("/api/shifts");
      const json = await res.json();
      if (json.success) {
        setShifts(json.data || []);
      } else {
        setError(json.error || "Failed to load shifts");
      }
    } catch (err) {
      setError("Failed to load shifts");
    } finally {
      setShiftsLoading(false);
    }
  }, []);

  // ─── Fetch Schedules ────────────────────────────────────────

  const fetchSchedules = useCallback(async () => {
    setSchedulesLoading(true);
    try {
      const res = await fetch("/api/schedules");
      const json = await res.json();
      if (json.success) {
        setSchedules(json.data || []);
      } else {
        setError(json.error || "Failed to load schedules");
      }
    } catch (err) {
      setError("Failed to load schedules");
    } finally {
      setSchedulesLoading(false);
    }
  }, []);

  // ─── Fetch Employees ────────────────────────────────────────

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/employees");
      const json = await res.json();
      if (json.success) {
        setEmployees(json.data || []);
      }
    } catch (err) {
      // Silent fail for employees list
    }
  }, []);

  useEffect(() => {
    fetchShifts();
    fetchSchedules();
    fetchEmployees();
  }, [fetchShifts, fetchSchedules, fetchEmployees]);

  // ─── Shift Management ────────────────────────────────────────

  const handleOpenShiftModal = (shift?: ShiftTemplate) => {
    if (shift) {
      setEditingShiftId(shift.id);
      setShiftForm({
        name: shift.name,
        type: shift.type,
        startTime: shift.startTime,
        endTime: shift.endTime,
        breakMinutes: shift.breakMinutes,
        workDays: [...shift.workDays],
        color: shift.color,
        isDefault: shift.isDefault,
      });
    } else {
      setEditingShiftId(null);
      setShiftForm({
        name: "",
        type: "morning",
        startTime: "09:00",
        endTime: "17:00",
        breakMinutes: 60,
        workDays: [1, 2, 3, 4, 5],
        color: "#3b82f6",
        isDefault: false,
      });
    }
    setError(null);
    setShiftsModalOpen(true);
  };

  const handleSubmitShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!shiftForm.name.trim()) {
      setError("Please enter a shift name");
      return;
    }

    setShiftSaving(true);
    try {
      const method = editingShiftId ? "PATCH" : "POST";
      const url = editingShiftId ? `/api/shifts/${editingShiftId}` : "/api/shifts";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(shiftForm),
      });

      const json = await res.json();

      if (!json.success) {
        setError(json.error || "Operation failed");
        setShiftSaving(false);
        return;
      }

      setSuccess(editingShiftId ? "Shift updated!" : "Shift created!");
      setShiftsModalOpen(false);
      await fetchShifts();

      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError("Operation failed");
    } finally {
      setShiftSaving(false);
    }
  };

  const handleDeleteShift = async (id: string) => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/shifts/${id}`, { method: "DELETE" });
      const json = await res.json();

      if (!json.success) {
        setError(json.error || "Failed to delete");
        setDeleting(false);
        return;
      }

      setSuccess("Shift deleted!");
      setDeleteConfirm(null);
      await fetchShifts();

      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError("Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const toggleWorkDay = (day: number) => {
    setShiftForm((prev) => ({
      ...prev,
      workDays: prev.workDays.includes(day)
        ? prev.workDays.filter((d) => d !== day)
        : [...prev.workDays, day].sort(),
    }));
  };

  // ─── Schedule Management ────────────────────────────────────

  const handleOpenScheduleModal = (schedule?: EmployeeSchedule) => {
    if (schedule) {
      setEditingScheduleId(schedule.id);
      setScheduleForm({
        employeeId: schedule.employeeId,
        shiftTemplateId: schedule.shiftTemplateId,
        startDate: schedule.startDate,
        endDate: schedule.endDate || "",
      });
    } else {
      setEditingScheduleId(null);
      setScheduleForm({
        employeeId: "",
        shiftTemplateId: "",
        startDate: "",
        endDate: "",
      });
    }
    setError(null);
    setSchedulesModalOpen(true);
  };

  const handleSubmitSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!scheduleForm.employeeId) {
      setError("Please select an employee");
      return;
    }
    if (!scheduleForm.shiftTemplateId) {
      setError("Please select a shift template");
      return;
    }
    if (!scheduleForm.startDate) {
      setError("Please enter a start date");
      return;
    }

    setScheduleSaving(true);
    try {
      const method = editingScheduleId ? "PATCH" : "POST";
      const url = editingScheduleId
        ? `/api/schedules/${editingScheduleId}`
        : "/api/schedules";

      const payload = {
        employeeId: scheduleForm.employeeId,
        shiftTemplateId: scheduleForm.shiftTemplateId,
        startDate: scheduleForm.startDate,
        endDate: scheduleForm.endDate || undefined,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!json.success) {
        setError(json.error || "Operation failed");
        setScheduleSaving(false);
        return;
      }

      setSuccess(editingScheduleId ? "Schedule updated!" : "Schedule assigned!");
      setSchedulesModalOpen(false);
      await fetchSchedules();

      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError("Operation failed");
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/schedules/${id}`, { method: "DELETE" });
      const json = await res.json();

      if (!json.success) {
        setError(json.error || "Failed to delete");
        setDeleting(false);
        return;
      }

      setSuccess("Schedule deleted!");
      setDeleteConfirm(null);
      await fetchSchedules();

      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError("Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Shifts & Schedules</h1>
        <p className="text-slate-600 mt-2">Manage shift templates and employee schedules</p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-start gap-3">
          <XCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div>{error}</div>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div>{success}</div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab("templates")}
            className={cn(
              "px-4 py-2 font-medium border-b-2 transition-colors",
              activeTab === "templates"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-600 hover:text-slate-900"
            )}
          >
            <Clock className="h-4 w-4 inline-block mr-2" />
            Shift Templates
          </button>
          <button
            onClick={() => setActiveTab("schedules")}
            className={cn(
              "px-4 py-2 font-medium border-b-2 transition-colors",
              activeTab === "schedules"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-600 hover:text-slate-900"
            )}
          >
            <Calendar className="h-4 w-4 inline-block mr-2" />
            Employee Schedules
          </button>
        </div>
      </div>

      {/* Shift Templates Tab */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-900">Shift Templates</h2>
            <button
              onClick={() => handleOpenShiftModal()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Shift
            </button>
          </div>

          {shiftsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 text-slate-400 animate-spin" />
            </div>
          ) : shifts.length === 0 ? (
            <div className="bg-slate-50 rounded-lg p-8 text-center">
              <Clock className="h-12 w-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600">No shift templates yet. Create one to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
                      Time
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
                      Break
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
                      Days
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
                      Default
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((shift) => (
                    <tr
                      key={shift.id}
                      className="border-b border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: shift.color }}
                          />
                          <span className="font-medium text-slate-900">{shift.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {shift.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {shift.startTime} - {shift.endTime}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {shift.breakMinutes} min
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {shift.workDays.map((d) => {
                          const day = DAYS_OF_WEEK.find((dow) => dow.value === d);
                          return day?.label;
                        }).join(", ")}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {shift.isDefault ? (
                          <span className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                            Yes
                          </span>
                        ) : (
                          <span className="text-slate-400">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleOpenShiftModal(shift)}
                          className="text-blue-600 hover:text-blue-700 mr-3 inline-block"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(shift.id)}
                          className="text-red-600 hover:text-red-700 inline-block"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Employee Schedules Tab */}
      {activeTab === "schedules" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-900">Employee Schedules</h2>
            <button
              onClick={() => handleOpenScheduleModal()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Assign Schedule
            </button>
          </div>

          {schedulesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 text-slate-400 animate-spin" />
            </div>
          ) : schedules.length === 0 ? (
            <div className="bg-slate-50 rounded-lg p-8 text-center">
              <Calendar className="h-12 w-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600">No schedules assigned yet. Assign one to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
                      Employee
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
                      Shift
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
                      Start Date
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
                      End Date
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((schedule) => (
                    <tr
                      key={schedule.id}
                      className="border-b border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {schedule.employeeName}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {schedule.shiftTemplateName}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {schedule.startDate}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {schedule.endDate ? schedule.endDate : <span className="text-slate-400">Ongoing</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleOpenScheduleModal(schedule)}
                          className="text-blue-600 hover:text-blue-700 mr-3 inline-block"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(schedule.id)}
                          className="text-red-600 hover:text-red-700 inline-block"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Shift Modal */}
      {shiftsModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingShiftId ? "Edit Shift" : "Create Shift"}
              </h3>
              <button
                onClick={() => setShiftsModalOpen(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitShift} className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Shift Name
                </label>
                <input
                  type="text"
                  value={shiftForm.name}
                  onChange={(e) => setShiftForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Morning Shift"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Type
                </label>
                <select
                  value={shiftForm.type}
                  onChange={(e) => setShiftForm((prev) => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {SHIFT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Time */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Start Time
                </label>
                <input
                  type="time"
                  value={shiftForm.startTime}
                  onChange={(e) => setShiftForm((prev) => ({ ...prev, startTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* End Time */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  End Time
                </label>
                <input
                  type="time"
                  value={shiftForm.endTime}
                  onChange={(e) => setShiftForm((prev) => ({ ...prev, endTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Break Minutes */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Break Duration (minutes)
                </label>
                <input
                  type="number"
                  value={shiftForm.breakMinutes}
                  onChange={(e) =>
                    setShiftForm((prev) => ({ ...prev, breakMinutes: parseInt(e.target.value, 10) }))
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>

              {/* Work Days */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Work Days
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleWorkDay(day.value)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        shiftForm.workDays.includes(day.value)
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      )}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={shiftForm.color}
                    onChange={(e) => setShiftForm((prev) => ({ ...prev, color: e.target.value }))}
                    className="h-10 w-16 cursor-pointer rounded-lg"
                  />
                  <span className="text-sm text-slate-600">{shiftForm.color}</span>
                </div>
              </div>

              {/* Default Toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={shiftForm.isDefault}
                  onChange={(e) =>
                    setShiftForm((prev) => ({ ...prev, isDefault: e.target.checked }))
                  }
                  className="h-4 w-4 rounded"
                />
                <label className="text-sm font-medium text-slate-900">Set as default shift</label>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShiftsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={shiftSaving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {shiftSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingShiftId ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {schedulesModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingScheduleId ? "Edit Schedule" : "Assign Schedule"}
              </h3>
              <button
                onClick={() => setSchedulesModalOpen(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSchedule} className="p-6 space-y-4">
              {/* Employee */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Employee
                </label>
                <select
                  value={scheduleForm.employeeId}
                  onChange={(e) =>
                    setScheduleForm((prev) => ({ ...prev, employeeId: e.target.value }))
                  }
                  disabled={editingScheduleId !== null}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                >
                  <option value="">Select an employee</option>
                  {employees.map((emp) => (
                    <option key={emp.uid} value={emp.uid}>
                      {emp.displayName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Shift Template */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Shift Template
                </label>
                <select
                  value={scheduleForm.shiftTemplateId}
                  onChange={(e) =>
                    setScheduleForm((prev) => ({ ...prev, shiftTemplateId: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a shift template</option>
                  {shifts.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={scheduleForm.startDate}
                  onChange={(e) =>
                    setScheduleForm((prev) => ({ ...prev, startDate: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  End Date (Optional)
                </label>
                <input
                  type="date"
                  value={scheduleForm.endDate}
                  onChange={(e) =>
                    setScheduleForm((prev) => ({ ...prev, endDate: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setSchedulesModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={scheduleSaving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {scheduleSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingScheduleId ? "Update" : "Assign"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4">
            <div className="p-6 flex flex-col items-center text-center">
              <AlertTriangle className="h-12 w-12 text-red-600 mb-3" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Confirm Delete</h3>
              <p className="text-slate-600 mb-6">
                Are you sure you want to delete this item? This action cannot be undone.
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (activeTab === "templates") {
                      handleDeleteShift(deleteConfirm);
                    } else {
                      handleDeleteSchedule(deleteConfirm);
                    }
                  }}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
