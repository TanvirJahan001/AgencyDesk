"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileBarChart,
  Loader2,
  AlertTriangle,
  CheckCircle,
  X,
  Search,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BulkAction {
  id: string;
  label: string;
  description: string;
}

interface SearchResult {
  id: string;
  label: string;
  email?: string;
  type: "employee" | "leave" | "timesheet" | "expense" | "department";
}

const BULK_ACTIONS: BulkAction[] = [
  {
    id: "delete_employees",
    label: "Delete Employees",
    description: "Permanently delete selected employees",
  },
  {
    id: "update_department",
    label: "Update Department",
    description: "Bulk assign employees to a department",
  },
  {
    id: "approve_leave",
    label: "Approve Leave Requests",
    description: "Approve selected leave requests",
  },
  {
    id: "reject_leave",
    label: "Reject Leave Requests",
    description: "Reject selected leave requests",
  },
  {
    id: "approve_timesheets",
    label: "Approve Timesheets",
    description: "Approve selected timesheets",
  },
  {
    id: "approve_expenses",
    label: "Approve Expenses",
    description: "Approve selected expenses",
  },
  {
    id: "generate_payslips",
    label: "Generate Payslips",
    description: "Trigger payslip generation for selected records",
  },
];

const DEPARTMENTS = ["IT", "HR", "Finance", "Marketing", "Operations", "Sales"];

export default function AdminBulkClient() {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedItems, setSelectedItems] = useState<SearchResult[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<{ processed: number; action: string } | null>(null);

  const performSearch = useCallback(async () => {
    if (!selectedAction || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    setError(null);

    try {
      const query = searchQuery.toLowerCase();
      let endpoint = "";
      let resultType: SearchResult["type"] = "employee";

      if (selectedAction === "delete_employees" || selectedAction === "update_department") {
        endpoint = `/api/employees?search=${encodeURIComponent(query)}&limit=20`;
        resultType = "employee";
      } else if (selectedAction === "approve_leave" || selectedAction === "reject_leave") {
        endpoint = `/api/leave?search=${encodeURIComponent(query)}&limit=20`;
        resultType = "leave";
      } else if (selectedAction === "approve_timesheets") {
        endpoint = `/api/timesheets?search=${encodeURIComponent(query)}&limit=20`;
        resultType = "timesheet";
      } else if (selectedAction === "approve_expenses") {
        endpoint = `/api/expenses?search=${encodeURIComponent(query)}&limit=20`;
        resultType = "expense";
      } else if (selectedAction === "generate_payslips") {
        endpoint = `/api/payslips?search=${encodeURIComponent(query)}&limit=20`;
        resultType = "employee";
      }

      if (!endpoint) {
        setSearchResults([]);
        return;
      }

      const res = await fetch(endpoint);
      const json = await res.json();

      if (json.success && Array.isArray(json.data)) {
        const mapped: SearchResult[] = json.data.map((item: any) => ({
          id: item.id || item.uid,
          label:
            item.displayName ||
            item.employeeName ||
            item.name ||
            item.email ||
            "Unknown",
          email: item.email,
          type: resultType,
        }));
        setSearchResults(mapped);
      }
    } catch (err) {
      setError("Failed to search. Please try again.");
    } finally {
      setSearching(false);
    }
  }, [selectedAction, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch();
    }, 300);

    return () => clearTimeout(timer);
  }, [performSearch]);

  const toggleItem = (item: SearchResult) => {
    setSelectedItems((prev) => {
      const exists = prev.find((s) => s.id === item.id);
      if (exists) {
        return prev.filter((s) => s.id !== item.id);
      } else {
        return [...prev, item];
      }
    });
  };

  const toggleAll = () => {
    if (selectedItems.length === searchResults.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems([...searchResults]);
    }
  };

  const handleExecute = async () => {
    if (selectedItems.length === 0) {
      setError("Please select at least one item");
      return;
    }

    if (selectedAction === "update_department" && !selectedDepartment) {
      setError("Please select a target department");
      return;
    }

    setShowConfirm(true);
  };

  const confirmExecute = async () => {
    setShowConfirm(false);
    setExecuting(true);
    setError(null);
    setSuccess(null);

    try {
      const requestBody: any = {
        action: selectedAction,
        ids: selectedItems.map((item) => item.id),
      };

      if (selectedAction === "update_department") {
        requestBody.data = { department: selectedDepartment };
      }

      const res = await fetch("/api/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const json = await res.json();

      if (!json.success) {
        setError(json.error || "Operation failed");
        return;
      }

      setResult(json.data);
      setSuccess(
        `Successfully completed: ${json.data.processed} items processed`
      );
      setSelectedItems([]);
      setSearchQuery("");
      setSearchResults([]);
      setSelectedDepartment("");

      setTimeout(() => {
        setSuccess(null);
        setResult(null);
      }, 5000);
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setExecuting(false);
    }
  };

  const action = BULK_ACTIONS.find((a) => a.id === selectedAction);

  return (
    <div className="space-y-6 p-6">
      {success && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800 flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          {success}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
        <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Caution:</strong> Some bulk operations are irreversible. Please
          review your selections carefully before executing.
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Bulk Operations</h1>
        <p className="mt-2 text-sm text-slate-600">
          Perform actions on multiple records at once (max 50 items per operation)
        </p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <label className="block text-sm font-medium text-slate-900 mb-3">
          Select Action
        </label>
        <div className="grid grid-cols-1 gap-3">
          {BULK_ACTIONS.map((a) => (
            <label
              key={a.id}
              className={cn(
                "flex items-start p-3 rounded-lg border cursor-pointer transition-colors",
                selectedAction === a.id
                  ? "border-brand-500 bg-brand-50"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              )}
            >
              <input
                type="radio"
                name="action"
                value={a.id}
                checked={selectedAction === a.id}
                onChange={(e) => {
                  setSelectedAction(e.target.value);
                  setSelectedItems([]);
                  setSearchQuery("");
                  setSearchResults([]);
                  setError(null);
                }}
                className="mt-1"
              />
              <div className="ml-3 flex-1">
                <div className="font-medium text-slate-900">{a.label}</div>
                <div className="text-xs text-slate-500">{a.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {selectedAction && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Search for {action?.label.toLowerCase() || "items"}
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={`Search ${action?.label.toLowerCase() || "items"}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 animate-spin" />
              )}
            </div>
          </div>

          {selectedAction === "update_department" && (
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Target Department
              </label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              >
                <option value="">-- Select Department --</option>
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-900">
                  Results ({searchResults.length})
                </label>
                <button
                  onClick={toggleAll}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  {selectedItems.length === searchResults.length
                    ? "Deselect all"
                    : "Select all"}
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-lg">
                {searchResults.map((item) => (
                  <label
                    key={item.id}
                    className={cn(
                      "flex items-center p-3 border-b last:border-b-0 cursor-pointer hover:bg-slate-50 transition-colors",
                      selectedItems.find((s) => s.id === item.id)
                        ? "bg-brand-50"
                        : ""
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={!!selectedItems.find((s) => s.id === item.id)}
                      onChange={() => toggleItem(item)}
                      className="cursor-pointer"
                    />
                    <div className="ml-3 flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate">
                        {item.label}
                      </div>
                      {item.email && (
                        <div className="text-xs text-slate-500 truncate">
                          {item.email}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {searchQuery && searchResults.length === 0 && !searching && (
            <div className="text-center py-8 text-slate-500">
              No results found. Try a different search.
            </div>
          )}
        </div>
      )}

      {selectedItems.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm font-medium text-blue-900">
            {selectedItems.length} item{selectedItems.length !== 1 ? "s" : ""} selected
          </div>
          <div className="mt-2 text-xs text-blue-800">
            {selectedItems.slice(0, 3).map((item) => (
              <div key={item.id}>{item.label}</div>
            ))}
            {selectedItems.length > 3 && (
              <div>... and {selectedItems.length - 3} more</div>
            )}
          </div>
        </div>
      )}

      {selectedAction && (
        <button
          onClick={handleExecute}
          disabled={
            executing || selectedItems.length === 0 ||
            (selectedAction === "update_department" && !selectedDepartment)
          }
          className={cn(
            "w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2",
            executing || selectedItems.length === 0 ||
            (selectedAction === "update_department" && !selectedDepartment)
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-brand-600 text-white hover:bg-brand-700"
          )}
        >
          {executing && <Loader2 className="h-4 w-4 animate-spin" />}
          Execute Bulk Action
        </button>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-1" />
              <div>
                <h2 className="font-bold text-slate-900">
                  Confirm Bulk Operation
                </h2>
                <p className="text-sm text-slate-600 mt-2">
                  You are about to perform "{action?.label}" on{" "}
                  <strong>{selectedItems.length}</strong> item
                  {selectedItems.length !== 1 ? "s" : ""}. This action{" "}
                  {["delete_employees", "reject_leave"].includes(selectedAction || "")
                    ? "cannot be undone."
                    : "cannot be easily reversed."}
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmExecute}
                disabled={executing}
                className={cn(
                  "px-4 py-2 rounded-lg font-medium text-white flex items-center gap-2",
                  executing
                    ? "bg-slate-400 cursor-not-allowed"
                    : "bg-red-600 hover:bg-red-700"
                )}
              >
                {executing && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm & Execute
              </button>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-green-900">Operation Completed</div>
              <div className="text-sm text-green-700 mt-1">
                {result.processed} record{result.processed !== 1 ? "s" : ""} processed
                for "{result.action}"
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
