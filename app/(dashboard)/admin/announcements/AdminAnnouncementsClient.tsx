"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Megaphone,
  Pin,
  Trash2,
  Edit,
  Plus,
  Loader2,
  X,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: "normal" | "important" | "urgent";
  pinned: boolean;
  expiresAt?: string;
  createdAt: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  normal: "bg-blue-100 text-blue-800",
  important: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
};

interface Props {
  initialAnnouncements?: Announcement[];
}

export default function AdminAnnouncementsClient({ initialAnnouncements = [] }: Props) {
  const [announcements, setAnnouncements] = useState<Announcement[]>(initialAnnouncements);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    content: "",
    priority: "normal" as "normal" | "important" | "urgent",
    pinned: false,
    expiresAt: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/announcements");
      const json = await res.json();
      if (json.success) {
        setAnnouncements(json.data || []);
      } else {
        setError(json.error || "Failed to load announcements");
      }
    } catch (err) {
      setError("Failed to load announcements");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleOpenModal = (announcement?: Announcement) => {
    if (announcement) {
      setEditingId(announcement.id);
      setForm({
        title: announcement.title,
        content: announcement.content,
        priority: announcement.priority,
        pinned: announcement.pinned,
        expiresAt: announcement.expiresAt || "",
      });
    } else {
      setEditingId(null);
      setForm({
        title: "",
        content: "",
        priority: "normal",
        pinned: false,
        expiresAt: "",
      });
    }
    setError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.title.trim() || !form.content.trim()) {
      setError("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      const method = editingId ? "PATCH" : "POST";
      const url = editingId
        ? `/api/announcements/${editingId}`
        : "/api/announcements";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          content: form.content.trim(),
          priority: form.priority,
          pinned: form.pinned,
          expiresAt: form.expiresAt || undefined,
        }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.error || "Operation failed");
        return;
      }

      setSuccess(
        editingId
          ? "Announcement updated successfully"
          : "Announcement created successfully"
      );
      setModalOpen(false);
      setEditingId(null);
      await fetchAnnouncements();
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
      const res = await fetch(`/api/announcements/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.error || "Failed to delete announcement");
        return;
      }

      setSuccess("Announcement deleted successfully");
      setDeleteConfirm(null);
      await fetchAnnouncements();
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const pinnedAnnouncements = announcements.filter((a) => a.pinned);
  const otherAnnouncements = announcements.filter((a) => !a.pinned);

  return (
    <div className="space-y-6">
      {/* Success toast */}
      {success && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Announcements</h1>
        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          New Announcement
        </button>
      </div>

      {/* Announcements */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      ) : announcements.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center text-sm text-slate-400">
          No announcements yet. Create your first announcement.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Pinned Announcements */}
          {pinnedAnnouncements.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                Pinned
              </h2>
              {pinnedAnnouncements.map((announcement) => (
                <div
                  key={announcement.id}
                  className="rounded-xl border-2 border-brand-200 bg-brand-50 p-5 shadow-sm"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Pin className="h-5 w-5 text-brand-600" />
                      <h3 className="text-lg font-semibold text-slate-900">
                        {announcement.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                          PRIORITY_COLORS[announcement.priority] ||
                            "bg-slate-100 text-slate-700"
                        )}
                      >
                        {announcement.priority}
                      </span>
                      <button
                        onClick={() => handleOpenModal(announcement)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-blue-600"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(announcement.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-slate-700 whitespace-pre-wrap">
                    {announcement.content}
                  </p>
                  {announcement.expiresAt && (
                    <p className="mt-3 text-xs text-slate-500">
                      Expires:{" "}
                      {new Date(announcement.expiresAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Other Announcements */}
          {otherAnnouncements.length > 0 && (
            <div className="space-y-3">
              {pinnedAnnouncements.length > 0 && (
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                  Recent
                </h2>
              )}
              {otherAnnouncements.map((announcement) => (
                <div
                  key={announcement.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {announcement.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                          PRIORITY_COLORS[announcement.priority] ||
                            "bg-slate-100 text-slate-700"
                        )}
                      >
                        {announcement.priority}
                      </span>
                      <button
                        onClick={() => handleOpenModal(announcement)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(announcement.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-slate-700 whitespace-pre-wrap">
                    {announcement.content}
                  </p>
                  {announcement.expiresAt && (
                    <p className="mt-3 text-xs text-slate-500">
                      Expires:{" "}
                      {new Date(announcement.expiresAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setModalOpen(false)}
          />
          <div className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                {editingId ? "Edit Announcement" : "New Announcement"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Title <span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="Announcement title…"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Content <span className="text-red-500 ml-0.5">*</span>
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, content: e.target.value }))
                  }
                  placeholder="Announcement content…"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Priority
                </label>
                <select
                  value={form.priority}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      priority: e.target.value as
                        | "normal"
                        | "important"
                        | "urgent",
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="normal">Normal</option>
                  <option value="important">Important</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pinned"
                  checked={form.pinned}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, pinned: e.target.checked }))
                  }
                  className="rounded border-slate-300"
                />
                <label
                  htmlFor="pinned"
                  className="text-sm font-medium text-slate-700"
                >
                  Pin to top
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Expires At (optional)
                </label>
                <input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, expiresAt: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingId ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => !deleting && setDeleteConfirm(null)}
          />
          <div className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-sm -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">
                Delete Announcement
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Are you sure you want to delete this announcement? This action
                cannot be undone.
              </p>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
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
