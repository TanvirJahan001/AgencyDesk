/**
 * app/api/auth/login/route.ts — POST /api/auth/login
 *
 * Accepts a Firebase ID token and creates a server session cookie.
 * This is a convenience alias — the canonical endpoint is POST /api/auth/session.
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

    const decoded = await adminAuth.verifyIdToken(idToken);

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

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });

    const response = NextResponse.json<ApiResponse<{ role: UserRole; uid: string }>>(
      { success: true, data: { role, uid: decoded.uid } },
      { status: 200 }
    );

    response.cookies.set("session", sessionCookie, {
      ...COOKIE_OPTIONS,
      maxAge: SESSION_DURATION_MS / 1000,
    });

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
    console.error("[POST /api/auth/login]", message);
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 401 }
    );
  }
}
