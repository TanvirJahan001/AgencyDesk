/**
 * GET /api/clients
 *   - Admin/CEO can see all clients
 *   - Query params: ?status=active&search=term
 *
 * POST /api/clients
 *   - Admin only. Creates a new client.
 *   - Required body: companyName, contactName, contactEmail, status, billingType
 */

import { type NextRequest } from "next/server";
import type { firestore } from "firebase-admin";
import {
  safeParseBody,
  ok,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api/helpers";
import { getAuthSession } from "@/lib/api/helpers";
import { hasRole } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import { sendNotificationToMany, getAdminAndCeoIds } from "@/lib/notifications/send";
import type { Client } from "@/types";

export async function GET(req: NextRequest) {
  try {
    // Auth
    const session = await getAuthSession(req);
    if (!session) return unauthorized();
    if (!hasRole(session, "admin", "ceo")) return forbidden();

    // Parse query params
    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status");
    const search = searchParams.get("search")?.toLowerCase() || "";

    // Fetch all clients
    let query: firestore.Query = adminDb.collection("clients");

    if (status) {
      query = query.where("status", "==", status);
    }

    const snapshot = await query.get();
    let clients = snapshot.docs.map((doc) => doc.data() as Client);

    // Filter by search term
    if (search) {
      clients = clients.filter(
        (c) =>
          c.companyName.toLowerCase().includes(search) ||
          c.contactName.toLowerCase().includes(search) ||
          c.contactEmail.toLowerCase().includes(search)
      );
    }

    return ok(clients);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    // Auth
    const session = await getAuthSession(req);
    if (!session) return unauthorized();
    if (!hasRole(session, "admin", "ceo")) return forbidden();

    // Parse body
    const body = await safeParseBody<{
      companyName: string;
      contactName: string;
      contactEmail: string;
      contactPhone?: string;
      address?: string;
      website?: string;
      industry?: string;
      status: string;
      billingType: string;
      monthlyRetainer?: number;
      currency?: string;
      notes?: string;
    }>(req);

    // Validate required fields
    const {
      companyName,
      contactName,
      contactEmail,
      status,
      billingType,
    } = body;

    if (!companyName?.trim())
      return badRequest("companyName is required");
    if (!contactName?.trim())
      return badRequest("contactName is required");
    if (!contactEmail?.trim())
      return badRequest("contactEmail is required");
    if (!status?.trim())
      return badRequest("status is required");
    if (!billingType?.trim())
      return badRequest("billingType is required");

    // Generate ID
    const id = adminDb.collection("clients").doc().id;

    // Create document
    const client: Client = {
      id,
      companyName: companyName.trim(),
      contactName: contactName.trim(),
      contactEmail: contactEmail.trim(),
      contactPhone: body.contactPhone?.trim() ?? "",
      address: body.address?.trim(),
      website: body.website?.trim(),
      industry: body.industry?.trim(),
      status: status as any,
      billingType: billingType as any,
      monthlyRetainer: body.monthlyRetainer,
      currency: body.currency || "USD",
      notes: body.notes?.trim(),
      createdBy: session.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await adminDb.collection("clients").doc(id).set(client);

    // Notify all admins/CEOs of new client
    try {
      const adminIds = await getAdminAndCeoIds();
      await sendNotificationToMany(adminIds, {
        type: "client_added",
        title: "New Client Added",
        message: `${companyName} has been added as a client`,
        linkTo: "/admin/clients",
        relatedId: id,
      });
    } catch {
      // Silent fail - notification should not break the operation
    }

    return ok(client);
  } catch (err) {
    return serverError(err);
  }
}
