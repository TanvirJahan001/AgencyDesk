/**
 * app/(dashboard)/ceo/clients/[id]/page.tsx
 *
 * Server component wrapper for CEO client detail (now with full CRUD).
 */

import ClientDetailClient from "@/app/(dashboard)/admin/clients/[id]/ClientDetailClient";

export default async function CEOClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientDetailClient clientId={id} />;
}
