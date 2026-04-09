/**
 * app/(dashboard)/ceo/projects/page.tsx
 *
 * Server component wrapper that renders AdminProjectsClient (now with full CRUD).
 */

import AdminProjectsClient from "../../admin/projects/AdminProjectsClient";

export const metadata = {
  title: "Projects | CEO",
  description: "Manage all company projects",
};

export default function CEOProjectsPage() {
  return <AdminProjectsClient />;
}
