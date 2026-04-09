/**
 * app/(dashboard)/layout.tsx — Dashboard Group Layout (Layer 2 Auth)
 *
 * This is the AUTHORITATIVE auth gate.
 * The Edge middleware (Layer 1) does a fast cookie check, but this
 * layout calls verifySessionCookie() via the Admin SDK to confirm
 * the token is still valid and not revoked.
 *
 * It also enforces role-based path access:
 *   - /admin/*   → only role=admin
 *   - /employee/* → only role=employee
 *   - /ceo/*     → only role=ceo
 *   - /settings  → any authenticated user
 *
 * ── Redirect-loop prevention ────────────────────────────────
 * When the cookie exists but is EXPIRED or REVOKED, a plain
 * redirect("/login") causes an infinite loop:
 *
 *   layout (invalid cookie) → redirect /login
 *   middleware (stale cookie still present) → redirect /employee
 *   layout (invalid cookie) → redirect /login …
 *
 * The fix: redirect to /api/auth/clear instead of /login directly.
 * That API route DELETES both cookies in its response headers, then
 * sends a 302 to /login — so the middleware never sees the stale
 * cookie on the subsequent /login request.
 */

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionCookie, hasRole } from "@/lib/auth/withRoleGuard";
import DashboardShell from "@/components/layout/DashboardShell";
import type { UserRole } from "@/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ── 1. Read session cookie ────────────────────────────────

  const cookieStore   = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    // No cookie at all → safe to redirect directly to login
    // (no stale cookie means no redirect-loop risk)
    redirect("/login");
  }

  // ── 2. Verify with Admin SDK (checks expiry + revocation) ─

  const session = await verifySessionCookie(sessionCookie);

  if (!session) {
    // Cookie EXISTS but is invalid/expired.
    // Redirect via /api/auth/clear so it deletes the cookie
    // header before sending the browser to /login.
    // Without this step the middleware would redirect back
    // here immediately, causing an infinite loop.
    redirect("/api/auth/clear?next=/login");
  }

  // ── 3. Role vs. path enforcement ──────────────────────────

  const headerStore = await headers();
  const pathname    = headerStore.get("x-invoke-path")
                   ?? headerStore.get("x-nextjs-page")
                   ?? "";

  // Map of path prefix → required roles
  const ROLE_RULES: { prefix: string; roles: UserRole[] }[] = [
    { prefix: "/admin",    roles: ["admin"]                    },
    { prefix: "/employee", roles: ["employee"]                 },
    { prefix: "/ceo",      roles: ["ceo"]                      },
    { prefix: "/settings", roles: ["admin", "employee", "ceo"] },
  ];

  for (const rule of ROLE_RULES) {
    if (pathname.startsWith(rule.prefix)) {
      if (!hasRole(session, ...rule.roles)) {
        redirect("/unauthorized");
      }
      break;
    }
  }

  // ── 4. Render the shell ───────────────────────────────────

  return <DashboardShell session={session}>{children}</DashboardShell>;
}
