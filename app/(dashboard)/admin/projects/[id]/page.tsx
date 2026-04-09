/**
 * app/(dashboard)/admin/projects/[id]/page.tsx
 *
 * Server component wrapper that passes projectId to ProjectDetailClient.
 */

import ProjectDetailClient from "./ProjectDetailClient";

interface Params {
  id: string;
}

export const metadata = {
  title: "Project Detail | Admin",
  description: "Manage project details and tasks",
};

export default async function ProjectDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  return <ProjectDetailClient projectId={id} />;
}
