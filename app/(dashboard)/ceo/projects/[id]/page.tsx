/**
 * app/(dashboard)/ceo/projects/[id]/page.tsx
 *
 * Server component wrapper for CEO project detail (read-only).
 */

import CEOProjectDetailClient from "./CEOProjectDetailClient";

interface Params {
  id: string;
}

export const metadata = {
  title: "Project Detail | CEO",
  description: "View project details and performance",
};

export default async function CEOProjectDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  return <CEOProjectDetailClient projectId={id} />;
}
