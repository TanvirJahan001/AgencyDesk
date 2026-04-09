"use client";

import { useState } from "react";
import { Megaphone, Pin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: "normal" | "important" | "urgent";
  pinned: boolean;
  createdAt: string;
  expiresAt: string | null;
}

interface Props {
  initialAnnouncements?: Announcement[];
}

export default function EmployeeAnnouncementsClient({ initialAnnouncements = [] }: Props) {
  const [announcements] = useState<Announcement[]>(initialAnnouncements);
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);

  const getPriorityColors = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800";
      case "important":
        return "bg-orange-100 text-orange-800";
      case "normal":
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const pinnedAnnouncements = announcements.filter((a) => a.pinned);
  const regularAnnouncements = announcements
    .filter((a) => !a.pinned)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-gray-600">Loading announcements...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Megaphone className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p className="text-red-600">Error loading announcements: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Megaphone className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Announcements</h1>
        </div>

        {announcements.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <Megaphone className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 text-lg">No announcements yet</p>
          </div>
        ) : (
          <>
            {pinnedAnnouncements.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Pin className="w-5 h-5 text-yellow-500" />
                  Pinned
                </h2>
                <div className="space-y-4">
                  {pinnedAnnouncements.map((announcement) => (
                    <AnnouncementCard
                      key={announcement.id}
                      announcement={announcement}
                      getPriorityColors={getPriorityColors}
                      formatDate={formatDate}
                    />
                  ))}
                </div>
              </div>
            )}

            {regularAnnouncements.length > 0 && (
              <div>
                {pinnedAnnouncements.length > 0 && (
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Recent
                  </h2>
                )}
                <div className="space-y-4">
                  {regularAnnouncements.map((announcement) => (
                    <AnnouncementCard
                      key={announcement.id}
                      announcement={announcement}
                      getPriorityColors={getPriorityColors}
                      formatDate={formatDate}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface AnnouncementCardProps {
  announcement: Announcement;
  getPriorityColors: (priority: string) => string;
  formatDate: (dateString: string) => string;
}

function AnnouncementCard({
  announcement,
  getPriorityColors,
  formatDate,
}: AnnouncementCardProps) {
  const isExpired =
    announcement.expiresAt &&
    new Date(announcement.expiresAt) < new Date();

  return (
    <div
      className={cn(
        "bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow",
        isExpired && "opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <h3 className="text-xl font-semibold text-gray-900 flex-1">
          {announcement.title}
        </h3>
        <span
          className={cn(
            "px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap",
            getPriorityColors(announcement.priority)
          )}
        >
          {announcement.priority.charAt(0).toUpperCase() +
            announcement.priority.slice(1)}
        </span>
      </div>

      <p className="text-gray-700 mb-4 whitespace-pre-wrap">
        {announcement.content}
      </p>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>Posted: {formatDate(announcement.createdAt)}</span>
        {announcement.expiresAt && (
          <span className={isExpired ? "text-red-600 font-medium" : ""}>
            Expires: {formatDate(announcement.expiresAt)}
            {isExpired && " (Expired)"}
          </span>
        )}
      </div>
    </div>
  );
}
