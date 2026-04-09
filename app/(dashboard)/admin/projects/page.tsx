/**
 * app/(dashboard)/admin/projects/page.tsx
 *
 * Server component wrapper that renders AdminProjectsClient.
 */

import AdminProjectsClient from "./AdminProjectsClient";

export const metadata = {
  title: "Projects | Admin",
  description: "Manage marketing agency projects",
};

export default function AdminProjectsPage() {
  return <AdminProjectsClient />;
}
