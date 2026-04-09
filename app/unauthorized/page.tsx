/**
 * app/unauthorized/page.tsx
 *
 * Shown when a user tries to access a route their role does not permit.
 */

import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-4 text-center">
      <ShieldAlert className="h-16 w-16 text-red-400" aria-hidden="true" />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Access Denied</h1>
        <p className="mt-2 text-sm text-slate-500">
          You don&apos;t have permission to view this page.
        </p>
      </div>
      <Link href="/" className="btn-primary">
        Go to Dashboard
      </Link>
    </main>
  );
}
