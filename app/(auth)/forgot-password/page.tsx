/**
 * app/(auth)/forgot-password/page.tsx — Forgot Password Page
 *
 * Sends a Firebase password-reset email.
 *
 * Flow:
 *   1. User enters their email and submits the form.
 *   2. Firebase sendPasswordResetEmail dispatches a reset link to the inbox.
 *   3. The page shows a success confirmation with instructions.
 *   4. User clicks the link in their email → Firebase-hosted reset page.
 *   5. After resetting, user returns here and signs in with the new password.
 *
 * Security notes:
 *   - Firebase does NOT reveal whether the email exists.  We mirror that
 *     behaviour and always show "email sent" to prevent enumeration.
 *   - Rate limiting is handled server-side by Firebase.
 */

"use client";

import { useState, FormEvent } from "react";
import { sendPasswordResetEmail, AuthError } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2, Mail } from "lucide-react";

// ── Firebase error → friendly message ─────────────────────────

const ERROR_MAP: Record<string, string> = {
  "auth/invalid-email":           "Please enter a valid email address.",
  "auth/too-many-requests":       "Too many requests. Please wait a few minutes.",
  "auth/network-request-failed":  "Network error. Check your connection.",
};

function friendlyError(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as AuthError).code;
    // user-not-found → still show success (prevents email enumeration)
    if (code === "auth/user-not-found") return "";
    if (ERROR_MAP[code]) return ERROR_MAP[code];
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}

// ── Component ─────────────────────────────────────────────────

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email, {
        // After resetting, redirect back to our login page
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
      });
      setSent(true);
    } catch (err: unknown) {
      const msg = friendlyError(err);
      if (msg) {
        setError(msg);
      } else {
        // Empty string means user-not-found — show success anyway
        setSent(true);
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Success state ───────────────────────────────────────────

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
          <CheckCircle2 className="h-6 w-6 text-green-600" aria-hidden="true" />
        </div>

        <h1 className="text-xl font-semibold text-slate-900">Check your email</h1>
        <p className="mt-2 text-sm text-slate-500">
          If an account exists for <strong className="text-slate-700">{email}</strong>,
          you&apos;ll receive a password reset link shortly.
        </p>

        <div className="mt-6 rounded-lg bg-slate-50 p-4 text-left text-sm text-slate-600 ring-1 ring-slate-200">
          <div className="mb-2 flex items-center gap-2 font-medium text-slate-900">
            <Mail className="h-4 w-4" aria-hidden="true" />
            What to do next
          </div>
          <ol className="list-inside list-decimal space-y-1 text-slate-500">
            <li>Open the email from <strong>noreply@firebase</strong></li>
            <li>Click the password reset link</li>
            <li>Choose a new password</li>
            <li>Return here and sign in</li>
          </ol>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={() => { setSent(false); setEmail(""); }}
            className="btn-ghost w-full justify-center text-sm"
          >
            Try a different email
          </button>
          <Link href="/login" className="btn-primary w-full justify-center text-sm">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  // ── Form state ──────────────────────────────────────────────

  return (
    <>
      <Link
        href="/login"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to sign in
      </Link>

      <h1 className="mb-1 text-xl font-semibold text-slate-900">
        Reset your password
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        Enter the email address associated with your account and we&apos;ll send
        you a link to reset your password.
      </p>

      {/* Error banner */}
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
        <div>
          <label
            htmlFor="reset-email"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Email address
          </label>
          <input
            id="reset-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="you@company.com"
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full justify-center"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Sending…
            </>
          ) : (
            "Send reset link"
          )}
        </button>
      </form>
    </>
  );
}
