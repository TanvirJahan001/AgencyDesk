/**
 * app/(dashboard)/admin/documents/AdminDocumentsClient.tsx
 *
 * Admin document management client:
 *  - Table view with filters
 *  - Upload document modal
 *  - Edit document modal
 *  - Delete with confirmation
 *  - Status badges and expiry warnings
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  Edit2,
  ExternalLink,
  Filter,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmployeeDocument, DocumentCategory, DocumentStatus } from "@/types";
import { DOCUMENT_CATEGORIES } from "@/types";

const STATUS_COLORS: Record<DocumentStatus, string> = {
  active:   "bg-green-100 text-green-800",
  expired:  "bg-red-100 text-red-800",
  archived: "bg-gray-100 text-gray-800",
};

type ModalMode = "add" | "edit" | null;

const EMPTY_FORM = {
  employeeId: "",
  title: "",
  category: "other" as DocumentCategory,
  description: "",
  fileUrl: "",
  fileName: "",
  fileType: "",
  expiresAt: "",
};

export default function AdminDocumentsClient() {
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [employees, setEmployees] = useState<Array<{ uid: string; displayName: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | "all">("all");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [modal, setModal] = useState<ModalMode>(null);
  const [editing, setEditing] = useState<EmployeeDocument | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EmployeeDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/documents");
      const json = await res.json();
      if (json.success) {
        setDocuments(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/employees");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setEmployees(json.data);
      }
    } catch {
      // Silently fail; employees dropdown won't populate
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
    fetchEmployees();
  }, [fetchDocuments, fetchEmployees]);

  const openAddModal = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setModal("add");
  };

  const openEditModal = (doc: EmployeeDocument) => {
    setEditing(doc);
    setForm({
      employeeId: doc.employeeId,
      title: doc.title,
      category: doc.category,
      description: doc.description || "",
      fileUrl: doc.fileUrl,
      fileName: doc.fileName,
      fileType: doc.fileType || "",
      expiresAt: doc.expiresAt || "",
    });
    setModal("edit");
  };

  const closeModal = () => {
    setModal(null);
    setEditing(null);
    setForm({ ...EMPTY_FORM });
  };

  const handleSave = async () => {
    setError(null);

    // Validation
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!form.fileUrl.trim()) {
      setError("File URL is required.");
      return;
    }
    if (!form.fileName.trim()) {
      setError("File name is required.");
      return;
    }

    if (modal === "add" && !form.employeeId) {
      setError("Employee is required.");
      return;
    }

    setSaving(true);
    try {
      const endpoint = editing ? `/api/documents/${editing.id}` : "/api/documents";
      const method = editing ? "PATCH" : "POST";

      const payload = editing
        ? {
            title: form.title,
            category: form.category,
            description: form.description || null,
            fileUrl: form.fileUrl,
            fileName: form.fileName,
            fileType: form.fileType || null,
            expiresAt: form.expiresAt || null,
          }
        : { ...form, expiresAt: form.expiresAt || null, description: form.description || null };

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!json.success) {
        setError(json.error || "Failed to save document.");
        return;
      }

      setSuccess(`Document ${editing ? "updated" : "created"} successfully.`);
      await fetchDocuments();
      closeModal();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${confirmDelete.id}`, { method: "DELETE" });
      const json = await res.json();

      if (!json.success) {
        setError(json.error || "Failed to delete document.");
        return;
      }

      setSuccess("Document deleted successfully.");
      await fetchDocuments();
      setConfirmDelete(null);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setDeleting(false);
    }
  };

  // Filter documents
  const filtered = documents.filter((doc) => {
    const matchesQuery =
      doc.employeeName.toLowerCase().includes(query.toLowerCase()) ||
      doc.title.toLowerCase().includes(query.toLowerCase()) ||
      doc.fileName.toLowerCase().includes(query.toLowerCase());

    const matchesCategory = categoryFilter === "all" || doc.category === categoryFilter;
    const matchesEmployee = employeeFilter === "all" || doc.employeeId === employeeFilter;

    return matchesQuery && matchesCategory && matchesEmployee;
  });

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="space-y-4">
      {/* Success/Error Messages */}
      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-800 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-100 border border-green-400 text-green-800 rounded-lg">
          {success}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex-1 flex gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by employee, title, or file..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as DocumentCategory | "all")}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            {DOCUMENT_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>

          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Employees</option>
            {employees.map((emp) => (
              <option key={emp.uid} value={emp.uid}>
                {emp.displayName}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={openAddModal}
          className="ml-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-5 h-5" />
          Upload Document
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Employee
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Title
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Category
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                File Name
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Expiry Date
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Status
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No documents found
                </td>
              </tr>
            ) : (
              filtered.map((doc) => {
                const expiredFlag = isExpired(doc.expiresAt);
                return (
                  <tr
                    key={doc.id}
                    className={cn("hover:bg-gray-50", expiredFlag && "bg-red-50")}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {doc.employeeName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {doc.title}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {DOCUMENT_CATEGORIES.find((c) => c.value === doc.category)?.label}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        {doc.fileName}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {doc.expiresAt ? (
                        <div className="flex items-center gap-2">
                          {new Date(doc.expiresAt).toLocaleDateString()}
                          {expiredFlag && (
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          STATUS_COLORS[doc.status]
                        )}
                      >
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(doc)}
                          className="p-1 text-blue-600 hover:bg-blue-100 rounded transition"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(doc)}
                          className="p-1 text-red-600 hover:bg-red-100 rounded transition"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Upload/Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold">
                {editing ? "Edit Document" : "Upload Document"}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Employee Select */}
              {!editing && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Employee *
                  </label>
                  <select
                    value={form.employeeId}
                    onChange={(e) =>
                      setForm({ ...form, employeeId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select an employee...</option>
                    {employees.map((emp) => (
                      <option key={emp.uid} value={emp.uid}>
                        {emp.displayName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g., Bachelor's Degree Certificate"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category *
                </label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value as DocumentCategory })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {DOCUMENT_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional notes about this document..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* File URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  File URL *
                </label>
                <input
                  type="text"
                  value={form.fileUrl}
                  onChange={(e) => setForm({ ...form, fileUrl: e.target.value })}
                  placeholder="https://example.com/document.pdf"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Provide the URL to an externally hosted document
                </p>
              </div>

              {/* File Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  File Name *
                </label>
                <input
                  type="text"
                  value={form.fileName}
                  onChange={(e) => setForm({ ...form, fileName: e.target.value })}
                  placeholder="e.g., degree_certificate.pdf"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* File Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  File Type
                </label>
                <input
                  type="text"
                  value={form.fileType}
                  onChange={(e) => setForm({ ...form, fileType: e.target.value })}
                  placeholder="e.g., application/pdf"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Expiry Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiry Date (Optional)
                </label>
                <input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  For certifications, licenses, or time-bound documents
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editing ? "Update Document" : "Upload Document"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-600" />
                <h2 className="text-lg font-bold">Delete Document?</h2>
              </div>
              <p className="text-gray-600">
                Are you sure you want to delete "{confirmDelete.title}"? This action cannot
                be undone.
              </p>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
