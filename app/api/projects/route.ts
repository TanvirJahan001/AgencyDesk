/**
 * GET /api/projects
 *   - Admin/CEO see all projects
 *   - Employees see only projects where they're in teamMembers
 *   - Query params: ?clientId=x&status=active&search=term
 *
 * POST /api/projects
 *   - Admin only. Creates a new project.
 *   - Required: name, clientId, serviceType, status, budget, startDate, deadline, managerId
 *   - Looks up clientName and managerName from Firestore
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
  notFound,
} from "@/lib/api/helpers";
import { getAuthSession } from "@/lib/api/helpers";
import { hasRole } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import { sendNotificationToMany, getAdminAndCeoIds, getProjectTeamIds } from "@/lib/notifications/send";
import type { Project, Client, AppUser } from "@/types";

export async function GET(req: NextRequest) {
  try {
    // Auth
    const session = await getAuthSession(req);
    if (!session) return unauthorized();

    // Parse query params
    const { searchParams } = req.nextUrl;
    const clientId = searchParams.get("clientId");
    const status = searchParams.get("status");
    const search = searchParams.get("search")?.toLowerCase() || "";

    // Build query
    let query: firestore.Query = adminDb.collection("projects");

    if (clientId) {
      query = query.where("clientId", "==", clientId);
    }

    if (status) {
      query = query.where("status", "==", status);
    }

    const snapshot = await query.get();
    let projects = snapshot.docs.map((doc) => doc.data() as Project);

    // Filter by search
    if (search) {
      projects = projects.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.clientName.toLowerCase().includes(search)
      );
    }

    // Filter by access level
    if (!hasRole(session, "admin", "ceo")) {
      // Employees only see projects they're on
      projects = projects.filter((p) => p.teamMembers.includes(session.uid));
    }

    return ok(projects);
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
      name: string;
      clientId: string;
      serviceType: string;
      status: string;
      description?: string;
      budget: number;
      spent?: number;
      currency?: string;
      startDate: string;
      deadline: string;
      completedDate?: string;
      teamMembers?: string[];
      managerId: string;
      tags?: string[];
    }>(req);

    // Validate required fields
    const {
      name,
      clientId,
      serviceType,
      status,
      budget,
      startDate,
      deadline,
      managerId,
    } = body;

    if (!name?.trim()) return badRequest("name is required");
    if (!clientId?.trim()) return badRequest("clientId is required");
    if (!serviceType?.trim()) return badRequest("serviceType is required");
    if (!status?.trim()) return badRequest("status is required");
    if (budget === undefined || budget === null)
      return badRequest("budget is required");
    if (!startDate?.trim()) return badRequest("startDate is required");
    if (!deadline?.trim()) return badRequest("deadline is required");
    if (!managerId?.trim()) return badRequest("managerId is required");

    // Lookup client
    const clientDoc = await adminDb.collection("clients").doc(clientId).get();
    if (!clientDoc.exists) return notFound(`Client ${clientId} not found`);
    const client = clientDoc.data() as Client;

    // Lookup manager
    const managerDoc = await adminDb.collection("users").doc(managerId).get();
    if (!managerDoc.exists) return notFound(`Manager ${managerId} not found`);
    const manager = managerDoc.data() as AppUser;

    // Generate ID
    const id = adminDb.collection("projects").doc().id;

    // Create document
    const project: Project = {
      id,
      name: name.trim(),
      clientId,
      clientName: client.companyName,
      serviceType,
      status: status as any,
      description: body.description?.trim(),
      budget,
      spent: body.spent ?? 0,
      currency: body.currency || "USD",
      startDate,
      deadline,
      completedDate: body.completedDate,
      teamMembers: body.teamMembers || [],
      managerId,
      managerName: manager.displayName,
      tags: body.tags,
      createdBy: session.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await adminDb.collection("projects").doc(id).set(project);

    // Notify all admins/CEOs of new project
    try {
      const adminIds = await getAdminAndCeoIds();
      await sendNotificationToMany(adminIds, {
        type: "project_created",
        title: "New Project",
        message: `Project '${name}' created for ${client.companyName}`,
        linkTo: "/admin/projects",
        relatedId: id,
      });
    } catch {
      // Silent fail - notification should not break the operation
    }

    // Notify all team members if assigned
    if (body.teamMembers && body.teamMembers.length > 0) {
      try {
        await sendNotificationToMany(body.teamMembers, {
          type: "project_assigned",
          title: "Assigned to Project",
          message: `You've been assigned to '${name}' for ${client.companyName}`,
          linkTo: "/employee/projects",
          relatedId: id,
        });
      } catch {
        // Silent fail - notification should not break the operation
      }
    }

    return ok(project);
  } catch (err) {
    return serverError(err);
  }
}
