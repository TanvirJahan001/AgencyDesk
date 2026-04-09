/**
 * app/api/documents/[id]/route.ts
 *
 * PATCH: Update document metadata (Admin/CEO only)
 * DELETE: Delete document (Admin only)
 */

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
import type { EmployeeDocument, DocumentStatus } from "@/types";
import { adminDb } from "@/lib/firebase/admin";

// ─── PATCH ────────────────────────────────────────────────────

export async function PATCH(
  req: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await paramsPromise;
    const session = await getSession();

    if (!session) return unauthorized();
    if (!hasRole(session, "admin", "ceo")) return forbidden();

    // Fetch existing document
    const docRef = adminDb.collection("employee_documents").doc(id);
    const docSnapshot = await docRef.get();

    if (!docSnapshot.exists) {
      return notFound("Document not found.");
    }

    const existingDoc = docSnapshot.data() as EmployeeDocument;

    // Parse request body
    const body = await safeParseBody<{
      title?: string;
      category?: string;
      description?: string;
      fileUrl?: string;
      fileName?: string;
      fileType?: string;
      expiresAt?: string | null;
      status?: string;
    }>(req);

    // Validation
    const errors = [
      body.title ? validateLength(body.title, "title", MAX_LENGTHS.title) : null,
      body.description ? validateLength(body.description, "description", MAX_LENGTHS.description) : null,
    ];

    const error = firstError(...errors);
    if (error) return badRequest(error);

    // Validate category if provided
    if (body.category) {
      const validCategories = ["contract", "id_document", "certificate", "tax_form", "offer_letter", "policy", "other"];
      if (!validCategories.includes(body.category)) {
        return badRequest("Invalid category.");
      }
    }

    // Validate status if provided
    if (body.status) {
      const validStatuses = ["active", "expired", "archived"];
      if (!validStatuses.includes(body.status)) {
        return badRequest("Invalid status.");
      }
    }

    // Determine new status
    let newStatus = body.status as DocumentStatus | undefined;
    if (!newStatus) {
      // Auto-compute status from expiresAt if provided
      if (body.expiresAt !== undefined) {
        newStatus = "active";
        if (body.expiresAt) {
          const expiryDate = new Date(body.expiresAt);
          if (expiryDate < new Date()) {
            newStatus = "expired";
          }
        }
      }
    }

    // Build update
    const now = new Date().toISOString();
    const updateData: Partial<EmployeeDocument> = {
      updatedAt: now,
    };

    if (body.title) updateData.title = body.title;
    if (body.category) updateData.category = body.category as any;
    if (body.description !== undefined) updateData.description = body.description || undefined;
    if (body.fileUrl) updateData.fileUrl = body.fileUrl;
    if (body.fileName) updateData.fileName = body.fileName;
    if (body.fileType !== undefined) updateData.fileType = body.fileType || undefined;
    if (body.expiresAt !== undefined) updateData.expiresAt = body.expiresAt || undefined;
    if (newStatus) updateData.status = newStatus;

    // Merge with existing
    const updated: EmployeeDocument = { ...existingDoc, ...updateData };

    await docRef.update(updateData);

    return ok(updated);
  } catch (err) {
    return serverError(err);
  }
}

// ─── DELETE ───────────────────────────────────────────────────

export async function DELETE(
  req: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await paramsPromise;
    const session = await getSession();

    if (!session) return unauthorized();

    // Only admin can delete
    if (!hasRole(session, "admin")) {
      return forbidden();
    }

    // Verify document exists
    const docRef = adminDb.collection("employee_documents").doc(id);
    const docSnapshot = await docRef.get();

    if (!docSnapshot.exists) {
      return notFound("Document not found.");
    }

    // Delete
    await docRef.delete();

    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
