/**
 * app/api/auth/logout/route.ts — POST /api/auth/logout
 *
 * Destroys the session cookie and revokes refresh tokens.
 * This is a convenience alias — the canonical endpoint is DELETE /api/auth/session.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import type { ApiResponse } from "@/types";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path:     "/",
};

export async function POST(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get("session")?.value;

    if (sessionCookie) {
      try {
        const decoded = await adminAuth.verifySessionCookie(sessionCookie);
        await adminAuth.revokeRefreshTokens(decoded.uid);
      } catch {
        // Cookie may already be invalid — continue to clear
      }
    }

    const response = NextResponse.json<ApiResponse>(
      { success: true },
      { status: 200 }
    );

    response.cookies.set("session", "", { ...COOKIE_OPTIONS, maxAge: 0 });
    response.cookies.set("__role", "", {
      httpOnly: false,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "strict",
      path:     "/",
      maxAge:   0,
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Sign-out failed.";
    console.error("[POST /api/auth/logout]", message);

    const response = NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
    response.cookies.set("session", "", { ...COOKIE_OPTIONS, maxAge: 0 });
    response.cookies.set("__role", "", {
      httpOnly: false,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "strict",
      path:     "/",
      maxAge:   0,
    });
    return response;
  }
}
