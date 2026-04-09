/**
 * app/api/documents/route.ts
 *
 * GET: Fetch documents
 *   - Admin/CEO: all documents, optionally filtered by employeeId
 *   - Employee: only own documents
 *
 * POST: Create new document metadata (Admin/CEO only)
 */

import { NextRequest } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import {
  safeParseBody,
  ok,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
  notFound,
} from "@/lib/api/helpers";
import { validateLength, firstError, MAX_LENGTHS } from "@/lib/api/validate";
import type { EmployeeDocument, DocumentCategory, DocumentStatus } from "@/types";
import { adminDb } from "@/lib/firebase/admin";

// ─── GET ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    // Determine which documents to fetch
    let query = adminDb.collection("employee_documents");

    // Fetch with single .where() only — no composite index needed.
    // JS-side filtering and sorting applied after fetch.
    let snapshot: FirebaseFirestore.QuerySnapshot;

    if (hasRole(session, "admin", "ceo")) {
      const employeeId = req.nextUrl.searchParams.get("employeeId");
      if (employeeId) {
        // Single-field where — safe, no composite index required
        snapshot = await query.where("employeeId", "==", employeeId).limit(500).get();
      } else {
        snapshot = await query.limit(500).get();
      }
    } else if (hasRole(session, "employee")) {
      snapshot = await query.where("employeeId", "==", session.uid).limit(200).get();
    } else {
      return forbidden();
    }

    // Sort by createdAt descending in JS (avoids composite index on employeeId + createdAt)
    const documents: EmployeeDocument[] = snapshot.docs
      .map((doc) => ({ ...(doc.data() as EmployeeDocument), id: doc.id }))
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    return ok(documents);
  } catch (err) {
    return serverError(err);
  }
}

// ─── POST ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    // Only admin/CEO can create documents
    if (!hasRole(session, "admin", "ceo")) {
      return forbidden();
    }

    const body = await safeParseBody<{
      employeeId?: string;
      title?: string;
      category?: string;
      fileUrl?: string;
      fileName?: string;
      description?: string;
      fileType?: string;
      expiresAt?: string;
    }>(req);

    // Validation
    const errors = [
      !body.employeeId ? "employeeId is required" : null,
      !body.title ? "title is required" : null,
      !body.category ? "category is required" : null,
      !body.fileUrl ? "fileUrl is required" : null,
      !body.fileName ? "fileName is required" : null,
      validateLength(body.title, "title", MAX_LENGTHS.title),
      validateLength(body.description, "description", MAX_LENGTHS.description),
    ];

    const error = firstError(...errors);
    if (error) return badRequest(error);

    // Validate category
    const validCategories = ["contract", "id_document", "certificate", "tax_form", "offer_letter", "policy", "other"];
    if (!validCategories.includes(body.category)) {
      return badRequest("Invalid category.");
    }

    // Look up employee to get their name
    const employeeRef = await adminDb.collection("users").doc(body.employeeId).get();
    if (!employeeRef.exists) {
      return notFound("Employee not found.");
    }

    const employeeData = employeeRef.data();
    const employeeName = employeeData?.displayName || "Unknown";

    // Determine status: "expired" if expiresAt is in the past, otherwise "active"
    let status: DocumentStatus = "active";
    if (body.expiresAt) {
      const expiryDate = new Date(body.expiresAt);
      if (expiryDate < new Date()) {
        status = "expired";
      }
    }

    // Create document
    const now = new Date().toISOString();
    const docRef = adminDb.collection("employee_documents").doc();
    const newDoc: EmployeeDocument = {
      id: docRef.id,
      employeeId: body.employeeId,
      employeeName,
      title: body.title,
      category: body.category as DocumentCategory,
      description: body.description,
      fileUrl: body.fileUrl,
      fileName: body.fileName,
      fileType: body.fileType,
      expiresAt: body.expiresAt,
      uploadedBy: session.uid,
      uploadedByName: session.name || session.email,
      status,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(newDoc);

    return ok(newDoc);
  } catch (err) {
    return serverError(err);
  }
}
