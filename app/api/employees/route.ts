/**
 * app/api/employees/route.ts
 *
 * GET    — List all employees (admin/CEO only)
 * POST   — Create new employee (admin only)
 * PATCH  — Update existing employee (admin only)
 * DELETE — Permanently delete employee from Auth + Firestore (admin only)
 */

import { NextRequest } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { adminDb, adminAuth } from "@/lib/firebase/admin";
import {
  safeParseBody,
  unauthorized,
  forbidden,
  badRequest,
  notFound,
  serverError,
  ok,
} from "@/lib/api/helpers";
import { validateEmail, validateLength, validateNonNegative, firstError, MAX_LENGTHS } from "@/lib/api/validate";
import type { AppUser } from "@/types";

// ── GET ──────────────────────────────────────────────────────

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) return forbidden("Admin or CEO access required.");

  try {
    // Plain fetch + JS sort to avoid needing single-field index on displayName.
    const snap = await adminDb.collection("users").limit(1000).get();
    const employees = snap.docs.map((d) => d.data() as AppUser);
    employees.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
    return ok(employees);
  } catch (err) {
    return serverError(err);
  }
}

// ── POST ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) return forbidden("Admin/CEO access required.");

  // Safe body parse — never throws on empty / malformed JSON
  const body = await safeParseBody<{
    displayName?:  string;
    email?:        string;
    password?:     string;
    role?:         string;
    department?:   string;
    position?:     string;
    hourlyRate?:   number;
    payType?:      string;
    salaryAmount?: number;
  }>(req);

  const { displayName, email, password, role, department, position, hourlyRate, payType, salaryAmount } = body;

  // Validate required fields
  if (!displayName?.trim()) return badRequest("displayName is required.");
  if (!email?.trim())       return badRequest("email is required.");
  if (!password?.trim())    return badRequest("password is required.");
  if (!role)                return badRequest("role is required.");

  if (!["admin", "employee", "ceo"].includes(role)) {
    return badRequest(`Invalid role "${role}". Must be admin, employee, or ceo.`);
  }

  // Input validation
  const validationError = firstError(
    validateEmail(email),
    validateLength(displayName, "displayName", MAX_LENGTHS.name),
    hourlyRate != null ? validateNonNegative(hourlyRate, "hourlyRate") : null,
  );
  if (validationError) return badRequest(validationError);

  try {
    // Create Firebase Auth user
    const authUser = await adminAuth.createUser({ email, password, displayName });

    const now: string = new Date().toISOString();
    // Build user doc — omit undefined fields so Firestore doesn't reject them
    const newUser: Record<string, unknown> = {
      uid:          authUser.uid,
      email,
      displayName,
      role:         role as AppUser["role"],
      createdAt:    now,
    };
    if (department)   newUser.department   = department;
    if (position)     newUser.position     = position;
    if (payType)      newUser.payType      = payType;
    if (salaryAmount != null) newUser.salaryAmount = salaryAmount;
    if (hourlyRate   != null) newUser.hourlyRate   = hourlyRate;

    await adminDb.collection("users").doc(authUser.uid).set(newUser);
    return ok(newUser);
  } catch (err) {
    return serverError(err);
  }
}

// ── PATCH ────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) return forbidden("Admin/CEO access required.");

  const body = await safeParseBody<{
    uid?:          string;
    disabled?:     boolean;
    displayName?:  string;
    email?:        string;
    role?:         string;
    department?:   string;
    position?:     string;
    hourlyRate?:   number;
    payType?:      string;
    salaryAmount?: number;
  }>(req);

  const { uid, disabled, ...updates } = body;

  if (!uid) return badRequest("uid is required.");

  try {
    // Handle activate / deactivate
    if (typeof disabled === "boolean") {
      await adminAuth.updateUser(uid, { disabled });
      await adminDb.collection("users").doc(uid).update({ disabled });
      return ok({ uid, disabled });
    }

    // Sanitise — only allow known safe fields
    const allowed: Record<string, unknown> = {};
    if (updates.displayName !== undefined) allowed.displayName = updates.displayName;
    if (updates.email       !== undefined) allowed.email       = updates.email;
    if (updates.role && ["admin", "employee", "ceo"].includes(updates.role)) {
      allowed.role = updates.role;
    }
    if (updates.department   !== undefined) allowed.department   = updates.department || null;
    if (updates.position     !== undefined) allowed.position     = updates.position   || null;
    if (updates.hourlyRate   !== undefined) allowed.hourlyRate   = updates.hourlyRate;
    if (updates.payType      !== undefined) allowed.payType      = updates.payType || null;
    if (updates.salaryAmount !== undefined) allowed.salaryAmount = updates.salaryAmount;

    if (Object.keys(allowed).length === 0) {
      return badRequest("No valid fields provided to update.");
    }

    await adminDb.collection("users").doc(uid).update(allowed);

    // Sync email to Firebase Auth if changed
    if (allowed.email) {
      await adminAuth.updateUser(uid, { email: allowed.email as string });
    }

    return ok({ uid, updated: allowed });
  } catch (err) {
    return serverError(err);
  }
}

// ── DELETE ───────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasRole(session, "admin", "ceo")) return forbidden("Admin/CEO access required.");

  const body = await safeParseBody<{ uid?: string }>(req);
  const { uid } = body;

  if (!uid) return badRequest("uid is required.");

  // Prevent self-deletion
  if (uid === session.uid) {
    return badRequest("You cannot delete your own account.");
  }

  try {
    // Verify the user exists in Firestore
    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (!userDoc.exists) return notFound("Employee not found.");

    // 1. Delete from Firebase Auth
    try {
      await adminAuth.deleteUser(uid);
    } catch (authErr: unknown) {
      // If user doesn't exist in Auth, continue with Firestore cleanup
      const msg = authErr instanceof Error ? authErr.message : "";
      if (!msg.includes("no user record")) {
        return serverError(authErr);
      }
    }

    // 2. Delete from Firestore users collection
    await adminDb.collection("users").doc(uid).delete();

    return ok({ uid, deleted: true });
  } catch (err) {
    return serverError(err);
  }
}
