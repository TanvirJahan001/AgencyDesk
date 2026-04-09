/**
 * app/(dashboard)/admin/clients/[id]/page.tsx
 *
 * Server component wrapper for client detail page.
 */

import ClientDetailClient from "./ClientDetailClient";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientDetailClient clientId={id} />;
}
