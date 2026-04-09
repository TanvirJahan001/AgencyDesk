/**
 * proxy.ts — Edge Proxy (runs before every matched request)
 *
 * Three-layer protection strategy:
 *
 *   Layer 1 — HERE (Edge Proxy)
 *     Fast, stateless cookie check.
 *     • Unauthenticated → redirect to /login?next=…
 *     • Authenticated but wrong role prefix → redirect to /unauthorized
 *     • Authenticated hitting auth pages → redirect to role home
 *     Uses the lightweight `__role` cookie (set by the session API route)
 *     so no Firebase Admin call is needed at the Edge.
 *
 *   Layer 2 — (dashboard)/layout.tsx (Server Component)
 *     Authoritative session verification with Firebase Admin SDK.
 *     Calls verifySessionCookie() to check token validity & revocation.
 *
 *   Layer 3 — Firestore Security Rules
 *     Per-document access control.  Even if a user crafts a direct
 *     Firestore request, the rules enforce role constraints.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ── Route definitions ─────────────────────────────────────────

/** Prefixes that require a valid session cookie */
const PROTECTED_PREFIXES = ["/admin", "/employee", "/ceo", "/settings"];

/** Pages only accessible when NOT signed in */
const AUTH_PAGES = ["/login", "/forgot-password"];

/** Maps each role to its home URL */
const ROLE_HOME: Record<string, string> = {
  admin:    "/admin",
  employee: "/employee",
  ceo:      "/ceo",
};

/** Maps each role to the URL prefixes it is allowed to visit */
const ROLE_ALLOWED_PREFIXES: Record<string, string[]> = {
  admin:    ["/admin", "/settings"],
  employee: ["/employee", "/settings"],
  ceo:      ["/ceo", "/settings"],
};

// ── Proxy ─────────────────────────────────────────────────────

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Read cookies set by /api/auth/session
  const hasSession = Boolean(request.cookies.get("session")?.value);
  const role       = request.cookies.get("__role")?.value ?? null;

  // ─ 1. Auth pages: redirect signed-in users to their dashboard ─

  if (AUTH_PAGES.some((p) => pathname.startsWith(p))) {
    if (hasSession && role) {
      const home = ROLE_HOME[role] ?? "/employee";
      return NextResponse.redirect(new URL(home, request.url));
    }
    // Not signed in → let them see the auth page
    return NextResponse.next();
  }

  // ─ 2. Protected routes: redirect unsigned users to /login ─────

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (isProtected && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ─ 3. Role-prefix enforcement ─────────────────────────────────

  if (isProtected && hasSession && role) {
    const allowed = ROLE_ALLOWED_PREFIXES[role] ?? [];
    const isAllowed = allowed.some((prefix) => pathname.startsWith(prefix));

    if (!isAllowed) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
  }

  // ─ 4. If session exists but role cookie is missing → pass through
  //      and let the dashboard layout do the authoritative check.

  return NextResponse.next();
}

// ── Matcher ───────────────────────────────────────────────────

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     *   _next/static, _next/image, favicon.ico, public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
