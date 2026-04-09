/**
 * app/(dashboard)/ceo/announcements/page.tsx
 *
 * Server component — fetches announcements directly via Admin SDK.
 */

import { getSession } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import { redirect } from "next/navigation";
import AdminAnnouncementsClient from "../../admin/announcements/AdminAnnouncementsClient";
import type { Announcement } from "@/types";

export const dynamic = "force-dynamic";

export default async function CEOAnnouncementsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let initialAnnouncements: Announcement[] = [];

  try {
    // Plain fetch + JS sort to avoid needing single-field index on createdAt.
    const snap = await adminDb
      .collection("announcements")
      .limit(100)
      .get();

    const now = new Date().toISOString();
    initialAnnouncements = snap.docs
      .map((d) => d.data() as Announcement)
      .filter((a) => !a.expiresAt || a.expiresAt > now);

    initialAnnouncements.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });
  } catch {
    try {
      const snap = await adminDb.collection("announcements").limit(100).get();
      const now = new Date().toISOString();
      initialAnnouncements = snap.docs
        .map((d) => d.data() as Announcement)
        .filter((a) => !a.expiresAt || a.expiresAt > now)
        .sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return (b.createdAt || "").localeCompare(a.createdAt || "");
        });
    } catch {
      initialAnnouncements = [];
    }
  }

  return <AdminAnnouncementsClient initialAnnouncements={initialAnnouncements} />;
}
