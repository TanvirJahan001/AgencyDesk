/**
 * lib/api/helpers.ts — Shared API Route Utilities
 *
 * Thin helpers used by every route handler:
 *   - safeParseBody()   — never throws on empty/malformed JSON
 *   - unauthorized()    — 401 helper
 *   - forbidden()       — 403 helper
 *   - badRequest()      — 400 helper with message
 *   - serverError()     — 500 helper
 *   - ok()              — 200 success with optional data
 *
 * Import pattern inside a route:
 *   import { safeParseBody, unauthorized, ok } from "@/lib/api/helpers";
 */

import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types";

// ─── Body parsing ─────────────────────────────────────────────

/**
 * Safely parse the JSON body from a Next.js Request.
 *
 * Returns `{}` (empty object) when:
 *   - The body is empty / Content-Length: 0
 *   - The body is not valid JSON
 *
 * This prevents the "Unexpected end of JSON input" 500 error that occurs
 * when routes blindly call `await req.json()` on a request with no body.
 */
export async function safeParseBody<T extends Record<string, unknown>>(
  req: Request
): Promise<T> {
  try {
    const text = await req.text();
    if (!text || text.trim() === "") return {} as T;
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

// ─── Response factories ───────────────────────────────────────

/** 401 Unauthorized */
export function unauthorized(message = "Unauthorized") {
  return NextResponse.json<ApiResponse>(
    { success: false, error: message },
    { status: 401 }
  );
}

/** 403 Forbidden */
export function forbidden(message = "Forbidden") {
  return NextResponse.json<ApiResponse>(
    { success: false, error: message },
    { status: 403 }
  );
}

/** 400 Bad Request */
export function badRequest(message: string) {
  return NextResponse.json<ApiResponse>(
    { success: false, error: message },
    { status: 400 }
  );
}

/** 404 Not Found */
export function notFound(message: string) {
  return NextResponse.json<ApiResponse>(
    { success: false, error: message },
    { status: 404 }
  );
}

/** 409 Conflict — resource already exists or state mismatch */
export function conflict(message: string) {
  return NextResponse.json<ApiResponse>(
    { success: false, error: message },
    { status: 409 }
  );
}

/** 422 Unprocessable Entity (validation failure) */
export function unprocessable(message: string) {
  return NextResponse.json<ApiResponse>(
    { success: false, error: message },
    { status: 422 }
  );
}

/** 500 Internal Server Error */
export function serverError(err: unknown) {
  const message =
    err instanceof Error ? err.message : "An unexpected error occurred.";
  console.error("[API error]", message, err);
  return NextResponse.json<ApiResponse>(
    { success: false, error: message },
    { status: 500 }
  );
}

/** 200 OK with optional data payload */
export function ok<T>(data?: T) {
  return NextResponse.json<ApiResponse<T>>({ success: true, data });
}

// ─── Auth helpers ─────────────────────────────────────────────

/**
 * Extract and verify the session cookie from an incoming request.
 * Returns the decoded session or null.
 */
export async function getAuthSession(req: Request) {
  // Cast to any to access Next.js cookie utilities
  const cookieHeader = (req as unknown as { cookies: { get: (k: string) => { value?: string } | undefined } })
    .cookies?.get("session")?.value;

  if (!cookieHeader) return null;

  const { verifySessionCookie } = await import("@/lib/auth/withRoleGuard");
  return verifySessionCookie(cookieHeader);
}
