/**
 * app/api/export/route.ts
 *
 * GET — Admin/CEO only. Export a collection as JSON.
 *
 * Query params:
 *   collection (required) — which collection to export
 *                          (users, attendance_sessions, leave_requests, expenses,
 *                           payroll_runs, invoices, contracts, departments)
 *
 * Returns:
 *   JSON array of all documents (limit 1000) with Content-Disposition header
 *   for download triggering on client.
 */

import { NextRequest } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import {
  unauthorized,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api/helpers";
import { NextResponse } from "next/server";

const ALLOWED_COLLECTIONS = [
  "users",
  "attendance_sessions",
  "leave_requests",
  "expenses",
  "payroll_runs",
  "invoices",
  "contracts",
  "departments",
];

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) return forbidden("Admin or CEO access required.");

  const collection = req.nextUrl.searchParams.get("collection");

  if (!collection) {
    return badRequest("collection query parameter is required.");
  }

  if (!ALLOWED_COLLECTIONS.includes(collection)) {
    return badRequest(
      `Invalid collection. Allowed: ${ALLOWED_COLLECTIONS.join(", ")}`
    );
  }

  try {
    // Fetch all documents from the collection (limit 1000)
    const snapshot = await adminDb
      .collection(collection)
      .limit(1000)
      .get();

    const data = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Create JSON response
    const jsonString = JSON.stringify(data, null, 2);
    const jsonBuffer = Buffer.from(jsonString, "utf-8");

    // Generate filename with timestamp
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const filename = `${collection}_export_${dateStr}.json`;

    // Return with download headers
    return new NextResponse(jsonBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": jsonBuffer.length.toString(),
      },
    });
  } catch (err) {
    return serverError(err);
  }
}
