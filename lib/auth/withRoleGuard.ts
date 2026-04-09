/**
 * lib/auth/withRoleGuard.ts — Server-Side Session Verification
 *
 * This file is imported ONLY by server-side code:
 *   - (dashboard)/layout.tsx
 *   - API routes
 *   - Server Components
 *
 * It uses the Firebase Admin SDK to verify session cookies and
 * look up the user's role from Firestore.
 *
 * ─── Three-Layer Auth Architecture ───
 *
 *   Layer 1: Edge Middleware
 *     Stateless check using __role cookie.  Fast but spoofable.
 *
 *   Layer 2: THIS FILE (Server Component / API)  ← authoritative
 *     Admin SDK verifies the signed session cookie + checks revocation.
 *     Looks up the real role from Firestore.
 *
 *   Layer 3: Firestore Security Rules
 *     Per-document enforcement at the database level.
 */

import type { UserRole } from "@/types";

/** Shape of a decoded session — used throughout server-side code. */
export interface DecodedSession {
  uid:   string;
  email: string;
  role:  UserRole;
  name?: string;
}

/**
 * Returns true if the session contains one of the allowed roles.
 *
 * @example
 *   if (!hasRole(session, "admin")) redirect("/unauthorized");
 */
export function hasRole(
  session: DecodedSession | null | undefined,
  ...allowedRoles: UserRole[]
): boolean {
  if (!session) return false;
  return allowedRoles.includes(session.role);
}

/**
 * Verifies a raw session-cookie string using the Firebase Admin SDK.
 * Returns the decoded session (including the Firestore-sourced role)
 * or null on any failure (expired, revoked, malformed, etc.).
 *
 * The second parameter `checkRevocation` defaults to true.
 * Set it to false in hot paths where a small window of stale data is acceptable.
 */
export async function verifySessionCookie(
  cookie: string,
  checkRevocation = true
): Promise<DecodedSession | null> {
  try {
    // Dynamic import keeps firebase-admin out of client bundles
    const { adminAuth, adminDb } = await import("@/lib/firebase/admin");

    const decoded = await adminAuth.verifySessionCookie(cookie, checkRevocation);

    // Authoritative role check — always read from Firestore
    const userDoc = await adminDb.collection("users").doc(decoded.uid).get();

    if (!userDoc.exists) {
      // User authenticated via Firebase Auth but has no Firestore profile.
      // Default to "employee" — the admin can upgrade later.
      return {
        uid:   decoded.uid,
        email: decoded.email ?? "",
        role:  "employee",
        name:  decoded.name,
      };
    }

    const data = userDoc.data()!;

    return {
      uid:   decoded.uid,
      email: decoded.email ?? "",
      role:  (data.role as UserRole) ?? "employee",
      name:  data.displayName ?? decoded.name,
    };
  } catch {
    // Any failure (expired, revoked, malformed) → not authenticated
    return null;
  }
}

/**
 * Convenience wrapper for Server Components and API routes.
 * Reads the session cookie from the request cookies, verifies it,
 * and returns the decoded session or null.
 */
export async function getSession(): Promise<DecodedSession | null> {
  // Dynamic import so this can be called from a Server Component
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) return null;

  return verifySessionCookie(sessionCookie);
}
