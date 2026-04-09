/**
 * app/(auth)/login/page.tsx — Login Page
 *
 * Full email/password sign-in via Firebase Auth.
 *
 * Flow:
 *   1. User submits credentials → Firebase Client SDK authenticates
 *   2. On success → POST ID token to /api/auth/session
 *   3. Server verifies token, creates httpOnly session cookie, returns role
 *   4. Client redirects to /admin or /employee based on role
 *
 * Features:
 *   - Friendly mapped error messages for every Firebase error code
 *   - Client-side rate limiting (5 attempts / 60 seconds)
 *   - Show/hide password toggle
 *   - "Forgot password?" link to /forgot-password
 *   - Accessible: labels, aria attributes, focus management
 */

"use client";

import { useState, useRef, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword, AuthError } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";

// ── Firebase error → user-friendly message ────────────────────

const ERROR_MAP: Record<string, string> = {
  "auth/invalid-email":        "Please enter a valid email address.",
  "auth/user-disabled":        "This account has been disabled. Contact your administrator.",
  "auth/user-not-found":       "No account found with this email.",
  "auth/wrong-password":       "Incorrect password. Please try again.",
  "auth/invalid-credential":   "Invalid email or password.",
  "auth/too-many-requests":    "Too many failed attempts. Please wait a few minutes and try again.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "auth/internal-error":       "An internal error occurred. Please try again later.",
  "auth/operation-not-allowed": "Email/password sign-in is not enabled. Contact your administrator.",
};

function friendlyError(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as AuthError).code;
    if (ERROR_MAP[code]) return ERROR_MAP[code];
  }
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred. Please try again.";
}

// ── Simple client-side rate limiter ───────────────────────────

const MAX_ATTEMPTS   = 5;
const WINDOW_SECONDS = 60;

function useRateLimiter() {
  const attemptsRef = useRef<number[]>([]);

  function check(): boolean {
    const now   = Date.now();
    const cutoff = now - WINDOW_SECONDS * 1000;
    attemptsRef.current = attemptsRef.current.filter((t) => t > cutoff);

    if (attemptsRef.current.length >= MAX_ATTEMPTS) {
      return false; // rate-limited
    }
    attemptsRef.current.push(now);
    return true;
  }

  function secondsUntilReset(): number {
    if (attemptsRef.current.length === 0) return 0;
    const oldest = attemptsRef.current[0];
    return Math.ceil((oldest + WINDOW_SECONDS * 1000 - Date.now()) / 1000);
  }

  return { check, secondsUntilReset };
}

// ── Component ─────────────────────────────────────────────────

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const redirectTo   = searchParams.get("next"); // e.g. /admin/payroll

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const rateLimiter = useRateLimiter();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Basic client validation
    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }

    // Rate-limit check
    if (!rateLimiter.check()) {
      const wait = rateLimiter.secondsUntilReset();
      setError(`Too many attempts. Please wait ${wait} seconds.`);
      return;
    }

    setLoading(true);

    try {
      // ① Authenticate with Firebase Client SDK
      const credential = await signInWithEmailAndPassword(auth, email, password);

      // ② Exchange ID token for a server session cookie
      const idToken = await credential.user.getIdToken();

      const res = await fetch("/api/auth/session", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ idToken }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create session. Please try again.");
      }

      const { data } = await res.json();
      const role: string = data?.role ?? "employee";

      // ③ Redirect: honour ?next= param if it matches the user's role prefix,
      //    otherwise go to the role's home page.
      const roleHome = role === "admin" ? "/admin" : role === "ceo" ? "/ceo" : "/employee";

      if (redirectTo && redirectTo.startsWith(roleHome)) {
        router.replace(redirectTo);
      } else {
        router.replace(roleHome);
      }
    } catch (err: unknown) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">
        Sign in to your account
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        Enter your credentials to access the dashboard.
      </p>

      {/* ── Error banner ── */}
      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Email */}
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="you@company.com"
            disabled={loading}
            aria-describedby={error ? "login-error" : undefined}
          />
        </div>

        {/* Password */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPass ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input pr-10"
              placeholder="••••••••"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPass((p) => !p)}
              className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
              aria-label={showPass ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPass ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full justify-center"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>
    </>
  );
}
