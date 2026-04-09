/**
 * app/api/auth/clear/route.ts
 *
 * GET — Force-clear session cookies then redirect to /login.
 *
 * Called by the dashboard layout when session verification fails.
 * Using a Response (not redirect()) lets us set cookie headers to
 * delete the stale cookies before sending the user to the login page.
 *
 * Without this, the middleware sees the stale cookies and keeps
 * bouncing the user back to the dashboard → infinite redirect loop.
 */

import { NextRequest, NextResponse } from "next/server";

const COOKIE_CLEAR = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path:     "/",
  maxAge:   0,
};

export async function GET(req: NextRequest) {
  const next = req.nextUrl.searchParams.get("next") ?? "/login";

  // Redirect to login (or whatever ?next= says)
  const response = NextResponse.redirect(new URL(next, req.url));

  // Clear the session cookie (httpOnly)
  response.cookies.set("session", "", COOKIE_CLEAR);

  // Clear the role cookie (non-httpOnly, read by Edge middleware)
  response.cookies.set("__role", "", {
    httpOnly: false,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   0,
  });

  return response;
}
