/**
 * app/api/profile/route.ts
 *
 * GET   — Returns current user's full profile from the users collection
 * PATCH — Employee updates own profile (allowed fields: displayName, phone, dateOfBirth, address, emergencyContacts, bio)
 *         Admin can additionally update: bankDetails, department, position
 */

import { NextRequest } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import {
  safeParseBody,
  unauthorized,
  badRequest,
  notFound,
  serverError,
  ok,
} from "@/lib/api/helpers";
import type { AppUser } from "@/types";

// ── GET ──────────────────────────────────────────────────────

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const userDoc = await adminDb.collection("users").doc(session.uid).get();
    if (!userDoc.exists) return notFound("User profile not found.");

    const user = userDoc.data() as AppUser;
    return ok(user);
  } catch (err) {
    return serverError(err);
  }
}

// ── PATCH ────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await safeParseBody<Partial<AppUser>>(req);

  try {
    // Get the current user document to validate updates
    const userDoc = await adminDb.collection("users").doc(session.uid).get();
    if (!userDoc.exists) return notFound("User profile not found.");

    const currentUser = userDoc.data() as AppUser;

    // Fields that any user can update
    const allowedSelfUpdateFields = [
      "displayName",
      "phone",
      "dateOfBirth",
      "address",
      "emergencyContacts",
      "bio",
    ];

    // Additional fields that only admins can update
    const adminOnlyFields = ["bankDetails", "department", "position"];

    const isAdmin = hasRole(session, "admin", "ceo");
    const allowedFields = isAdmin
      ? [...allowedSelfUpdateFields, ...adminOnlyFields]
      : allowedSelfUpdateFields;

    // Build the update object — only include allowed fields
    const updates: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key)) {
        updates[key] = value;
      }
    }

    // Ensure role doesn't change
    if ("role" in body && body.role !== currentUser.role) {
      return badRequest("Cannot change your own role.");
    }

    // Perform the update
    await adminDb.collection("users").doc(session.uid).update(updates);

    // Fetch and return the updated user
    const updatedDoc = await adminDb.collection("users").doc(session.uid).get();
    const updatedUser = updatedDoc.data() as AppUser;

    return ok(updatedUser);
  } catch (err) {
    return serverError(err);
  }
}
