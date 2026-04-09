/**
 * app/page.tsx — Root Redirect
 *
 * The root "/" route immediately redirects to the login page.
 * Authenticated users are sent to their dashboard by middleware.
 */

import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/login");
}
