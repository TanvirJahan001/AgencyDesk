/**
 * POST /api/auth/change-password
 *
 * Change the signed-in user's password.
 * Body: { currentPassword: string, newPassword: string }
 *
 * Steps:
 *   1. Verify the current password via Firebase REST API
 *   2. Update the password via Admin SDK
 */

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/withRoleGuard";
import { adminAuth } from "@/lib/firebase/admin";
import { safeParseBody, unauthorized, badRequest, serverError, ok } from "@/lib/api/helpers";

export async function POST(req: NextRequest) {
  // 1. Auth
  const session = await getSession();
  if (!session) return unauthorized("Authentication required.");

  // 2. Parse body safely — returns {} on empty / invalid JSON
  const body = await safeParseBody<{
    currentPassword?: string;
    newPassword?: string;
  }>(req);

  const { currentPassword, newPassword } = body;

  // 3. Validate required fields
  if (!currentPassword || !newPassword) {
    return badRequest("Both currentPassword and newPassword are required.");
  }
  if (newPassword.length < 8) {
    return badRequest("New password must be at least 8 characters.");
  }

  // 4. Verify current password via Firebase Auth REST API
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) return serverError(new Error("Firebase API key not configured."));

  try {
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email:             session.email,
          password:          currentPassword,
          returnSecureToken: false,
        }),
      }
    );

    const verifyData = await verifyRes.json();

    if (!verifyRes.ok || verifyData.error) {
      const msg = verifyData.error?.message ?? "";
      if (
        msg.includes("INVALID_PASSWORD") ||
        msg.includes("INVALID_LOGIN_CREDENTIALS") ||
        msg.includes("EMAIL_NOT_FOUND")
      ) {
        return badRequest("Current password is incorrect.");
      }
      return badRequest("Could not verify current password.");
    }
  } catch {
    return serverError(new Error("Password verification request failed."));
  }

  // 5. Update password via Admin SDK
  try {
    await adminAuth.updateUser(session.uid, { password: newPassword });
    return ok({ message: "Password updated successfully." });
  } catch (err) {
    return serverError(err);
  }
}
