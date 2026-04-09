/**
 * GET /api/clients/[id]
 *   - Admin/CEO only. Get single client by ID.
 *
 * PATCH /api/clients/[id]
 *   - Admin only. Update client fields.
 *
 * DELETE /api/clients/[id]
 *   - Admin only. Delete client.
 *   - Check no active projects linked.
 */

import { type NextRequest } from "next/server";
import {
  safeParseBody,
  ok,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
  notFound,
} from "@/lib/api/helpers";
import { getAuthSession } from "@/lib/api/helpers";
import { hasRole } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import type { Client } from "@/types";

async function getClient(id: string): Promise<Client | null> {
  const doc = await adminDb.collection("clients").doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as Client;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Auth
    const session = await getAuthSession(req);
    if (!session) return unauthorized();
    if (!hasRole(session, "admin", "ceo")) return forbidden();

    const client = await getClient(id);
    if (!client) return notFound(`Client ${id} not found`);

    return ok(client);
  } catch (err) {
    return serverError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Auth
    const session = await getAuthSession(req);
    if (!session) return unauthorized();
    if (!hasRole(session, "admin", "ceo")) return forbidden();

    // Get existing client
    const client = await getClient(id);
    if (!client) return notFound(`Client ${id} not found`);

    // Parse body
    const body = await safeParseBody<Partial<Client>>(req);

    // Update allowed fields
    const updated: Client = {
      ...client,
      ...(body.companyName && { companyName: body.companyName.trim() }),
      ...(body.contactName && { contactName: body.contactName.trim() }),
      ...(body.contactEmail && { contactEmail: body.contactEmail.trim() }),
      ...(body.contactPhone !== undefined && {
        contactPhone: body.contactPhone?.trim(),
      }),
      ...(body.address !== undefined && { address: body.address?.trim() }),
      ...(body.website !== undefined && { website: body.website?.trim() }),
      ...(body.industry !== undefined && { industry: body.industry?.trim() }),
      ...(body.status && { status: body.status }),
      ...(body.billingType && { billingType: body.billingType }),
      ...(body.monthlyRetainer !== undefined && {
        monthlyRetainer: body.monthlyRetainer,
      }),
      ...(body.currency && { currency: body.currency }),
      ...(body.notes !== undefined && { notes: body.notes?.trim() }),
      updatedAt: new Date().toISOString(),
    };

    await adminDb.collection("clients").doc(id).set(updated);

    return ok(updated);
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Auth
    const session = await getAuthSession(req);
    if (!session) return unauthorized();
    if (!hasRole(session, "admin", "ceo")) return forbidden();

    // Check client exists
    const client = await getClient(id);
    if (!client) return notFound(`Client ${id} not found`);

    // Check no active projects linked
    // Single .where() + JS filter to avoid composite index on clientId + status.
    const allClientProjects = await adminDb
      .collection("projects")
      .where("clientId", "==", id)
      .limit(500)
      .get();
    const activeProjects = allClientProjects.docs.filter((d) =>
      ["active", "proposal"].includes(d.data().status)
    );

    if (activeProjects.length > 0) {
      return badRequest(
        "Cannot delete client with active or proposal projects"
      );
    }

    // Delete client
    await adminDb.collection("clients").doc(id).delete();

    return ok();
  } catch (err) {
    return serverError(err);
  }
}
