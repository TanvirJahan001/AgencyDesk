/**
 * app/(dashboard)/admin/announcements/page.tsx
 *
 * Server component — fetches announcements directly via Admin SDK
 * and passes them as props to the client component.
 * This avoids client-side useEffect hydration issues.
 */

import { getSession } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import { redirect } from "next/navigation";
import AdminAnnouncementsClient from "./AdminAnnouncementsClient";
import type { Announcement } from "@/types";

export const dynamic = "force-dynamic";

export default async function AdminAnnouncementsPage() {
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

    // pinned first, then createdAt desc
    initialAnnouncements.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });
  } catch {
    // fallback — simple get without orderBy
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
