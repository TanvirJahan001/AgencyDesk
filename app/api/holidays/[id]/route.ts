/**
 * app/api/holidays/[id]/route.ts
 *
 * DELETE — Delete holiday. Admin only.
 */

import { NextRequest } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import {
  unauthorized,
  forbidden,
  notFound,
  serverError,
  ok,
} from "@/lib/api/helpers";
import type { Holiday } from "@/types";

// ── DELETE ───────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) return forbidden("Admin/CEO access required.");

  const { id } = await params;

  try {
    const doc = await adminDb.collection("holidays").doc(id).get();
    if (!doc.exists) return notFound("Holiday not found.");

    const holiday = doc.data() as Holiday;

    await adminDb.collection("holidays").doc(id).delete();

    return ok({ id, deleted: true, holiday });
  } catch (err) {
    return serverError(err);
  }
}
