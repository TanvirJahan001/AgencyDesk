/**
 * app/(dashboard)/ceo/clients/page.tsx
 *
 * Server component wrapper for CEO clients list (now with full CRUD).
 */

import AdminClientsClient from "../../admin/clients/AdminClientsClient";

export default function CEOClientsPage() {
  return <AdminClientsClient />;
}
