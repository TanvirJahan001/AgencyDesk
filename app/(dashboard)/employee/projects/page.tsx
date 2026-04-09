/**
 * app/(dashboard)/employee/projects/page.tsx
 *
 * Server component wrapper that renders EmployeeProjectsClient.
 */

import EmployeeProjectsClient from "./EmployeeProjectsClient";

export const metadata = {
  title: "My Projects | Employee",
  description: "View projects you are assigned to",
};

export default function EmployeeProjectsPage() {
  return <EmployeeProjectsClient />;
}
