/**
 * app/api/auth/session/route.ts — Server Session Management
 *
 * POST   /api/auth/session   → Create session cookie from Firebase ID token
 * DELETE /api/auth/session   → Destroy session cookie and revoke refresh tokens
 * GET    /api/auth/session   → Return current session info (role, uid, email)
 *
 * The session cookie is httpOnly, Secure in production, SameSite=Lax.
 * It also sets a lightweight __role cookie (non-httpOnly) that the Edge
 * middleware can read for fast role-prefix checks without calling Admin SDK.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { UserRole, ApiResponse } from "@/types";

const SESSION_DURATION_MS = 60 * 60 * 24 * 1 * 1000; // 24 hours

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path:     "/",
};

// ── POST: Create Session ──────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { idToken } = body as { idToken?: string };

    if (!idToken) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "idToken is required." },
        { status: 400 }
      );
    }

    // ① Verify the ID token with Firebase Admin
    const decoded = await adminAuth.verifyIdToken(idToken);

    // ② Look up the user's role in Firestore /users/{uid}
    const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
    const userData = userDoc.data();
    const role: UserRole = (userData?.role as UserRole) ?? "employee";

    // Block login for users not created by admin
    if (!userDoc.exists) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Account not provisioned. Contact your administrator." },
        { status: 403 }
      );
    }

    // ③ Create a server-managed session cookie
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });

    // ④ Build the response
    const response = NextResponse.json<ApiResponse<{ role: UserRole; uid: string }>>(
      { success: true, data: { role, uid: decoded.uid } },
      { status: 200 }
    );

    // Session cookie — httpOnly, never readable by JS
    response.cookies.set("session", sessionCookie, {
      ...COOKIE_OPTIONS,
      maxAge: SESSION_DURATION_MS / 1000,
    });

    // Role cookie — readable by Edge middleware for fast prefix checks
    // NOT httpOnly so middleware can read it.  Contains only the role string.
    response.cookies.set("__role", role, {
      httpOnly: false,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "strict",
      path:     "/",
      maxAge:   SESSION_DURATION_MS / 1000,
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Authentication failed.";
    console.error("[POST /api/auth/session]", message);
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 401 }
    );
  }
}

// ── GET: Read Session ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Not authenticated." },
        { status: 401 }
      );
    }

    // Verify the session cookie (check revocation)
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);

    // Look up the role
    const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
    const role: UserRole = (userDoc.data()?.role as UserRole) ?? "employee";

    return NextResponse.json<
      ApiResponse<{ uid: string; email: string; role: UserRole; name: string | undefined }>
    >({
      success: true,
      data: {
        uid:   decoded.uid,
        email: decoded.email ?? "",
        role,
        name:  decoded.name,
      },
    });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Invalid or expired session." },
      { status: 401 }
    );
  }
}

// ── DELETE: Destroy Session ───────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get("session")?.value;

    if (sessionCookie) {
      // Verify and revoke all refresh tokens for this user
      try {
        const decoded = await adminAuth.verifySessionCookie(sessionCookie);
        await adminAuth.revokeRefreshTokens(decoded.uid);
      } catch {
        // Cookie may already be invalid — continue to clear it anyway
      }
    }

    const response = NextResponse.json<ApiResponse>(
      { success: true },
      { status: 200 }
    );

    // Clear both cookies
    response.cookies.set("session", "", { ...COOKIE_OPTIONS, maxAge: 0 });
    response.cookies.set("__role",  "", {
      httpOnly: false,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "strict",
      path:     "/",
      maxAge:   0,
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Sign-out failed.";
    console.error("[DELETE /api/auth/session]", message);

    // Still clear cookies even if revocation fails
    const response = NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
    response.cookies.set("session", "", { ...COOKIE_OPTIONS, maxAge: 0 });
    response.cookies.set("__role",  "", {
      httpOnly: false,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "strict",
      path:     "/",
      maxAge:   0,
    });
    return response;
  }
}
