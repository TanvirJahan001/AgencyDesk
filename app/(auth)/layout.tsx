/**
 * app/(auth)/layout.tsx — Auth Group Layout
 *
 * Shared shell for login / password-reset / etc.
 * Centred card layout with a branded header.
 * The "(auth)" folder name is a Next.js route group — it does NOT
 * appear in the URL.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4">
      {/* Brand mark */}
      <div className="mb-8 text-center">
        <span className="text-2xl font-bold text-brand-700 tracking-tight">
          AgencyDesk
        </span>
        <p className="mt-1 text-sm text-slate-500">
          Agency Management System
        </p>
      </div>

      {/* Auth card */}
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg ring-1 ring-slate-200">
        {children}
      </div>

      <p className="mt-6 text-xs text-slate-400">
        © {new Date().getFullYear()} AgencyDesk. All rights reserved. Developed by Tanvir Jahan.
      </p>
    </div>
  );
}
