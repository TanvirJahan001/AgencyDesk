/**
 * app/(dashboard)/employee/projects/[id]/page.tsx
 *
 * Server component wrapper for employee project detail.
 */

import EmployeeProjectDetailClient from "./EmployeeProjectDetailClient";

interface Params {
  id: string;
}

export const metadata = {
  title: "Project Detail | Employee",
  description: "View and manage your tasks on this project",
};

export default async function EmployeeProjectDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  return <EmployeeProjectDetailClient projectId={id} />;
}
