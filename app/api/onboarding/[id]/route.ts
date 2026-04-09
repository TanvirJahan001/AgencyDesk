/**
 * app/api/onboarding/[id]/route.ts
 *
 * PATCH: Update onboarding record (Admin/CEO only)
 *        - Toggle checklist items
 *        - Change status
 *        - Update notes
 * DELETE: Delete onboarding record (Admin only)
 */

import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import {
  safeParseBody,
  ok,
  unauthorized,
  forbidden,
  badRequest,
  notFound,
  serverError,
} from "@/lib/api/helpers";
import { adminDb } from "@/lib/firebase/admin";
import type { OnboardingRecord } from "@/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();

    if (!hasRole(session, "admin", "ceo")) {
      return unauthorized();
    }

    const body = await safeParseBody<{
      status?: string;
      checklist?: Array<{ id: string; completed: boolean; notes?: string }>;
      notes?: string;
    }>(request);

    // Fetch existing record
    const docRef = adminDb.collection("onboarding").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return notFound("Onboarding record not found");
    }

    const record = doc.data() as OnboardingRecord;
    const now = new Date().toISOString();

    // Update checklist if provided
    let updatedChecklist = record.checklist;
    if (body.checklist && Array.isArray(body.checklist)) {
      updatedChecklist = record.checklist.map((item) => {
        const update = body.checklist!.find((c) => c.id === item.id);
        if (update) {
          return {
            ...item,
            completed: update.completed,
            completedAt: update.completed ? (item.completedAt || now) : undefined,
            completedBy: update.completed ? (item.completedBy || session.uid) : undefined,
            notes: update.notes !== undefined ? update.notes : item.notes,
          };
        }
        return item;
      });
    }

    const updates: Partial<OnboardingRecord> = {
      updatedAt: now,
      checklist: updatedChecklist,
    };

    if (body.status) {
      updates.status = body.status as any;
      // Mark as completed if all items are done
      if (body.status === "completed") {
        updates.completedAt = now;
      }
    }

    if (body.notes !== undefined) {
      updates.notes = body.notes;
    }

    await docRef.update(updates);

    const updated = await docRef.get();
    return ok(updated.data() as OnboardingRecord);
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();

    if (!hasRole(session, "admin")) {
      return forbidden();
    }

    const docRef = adminDb.collection("onboarding").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return notFound("Onboarding record not found");
    }

    await docRef.delete();

    return ok({ id, deleted: true });
  } catch (err) {
    return serverError(err);
  }
}
