/**
 * app/(dashboard)/employee/documents/EmployeeDocumentsClient.tsx
 *
 * Employee read-only view of their own documents:
 *  - Table view with filters
 *  - Category filter
 *  - No edit/delete
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { ExternalLink, Loader2, Search, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmployeeDocument, DocumentCategory, DocumentStatus } from "@/types";
import { DOCUMENT_CATEGORIES } from "@/types";

const STATUS_COLORS: Record<DocumentStatus, string> = {
  active:   "bg-green-100 text-green-800",
  expired:  "bg-red-100 text-red-800",
  archived: "bg-gray-100 text-gray-800",
};

export default function EmployeeDocumentsClient() {
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | "all">("all");
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/documents");
      const json = await res.json();
      if (json.success) {
        setDocuments(json.data);
      } else {
        setError(json.error || "Failed to load documents.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Filter documents
  const filtered = documents.filter((doc) => {
    const matchesQuery =
      doc.title.toLowerCase().includes(query.toLowerCase()) ||
      doc.fileName.toLowerCase().includes(query.toLowerCase());

    const matchesCategory = categoryFilter === "all" || doc.category === categoryFilter;

    return matchesQuery && matchesCategory;
  });

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="space-y-4">
      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-800 rounded-lg">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by title or file name..."
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
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
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
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  {documents.length === 0
                    ? "No documents uploaded yet"
                    : "No documents match your filters"}
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
                            <span title="Document has expired"><AlertTriangle className="w-4 h-4 text-red-600" /></span>
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
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        View
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
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
