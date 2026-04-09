/**
 * app/(dashboard)/employee/corrections/page.tsx
 *
 * Employee — Correction Requests
 *  • Submit a new correction request
 *  • View all past requests and their status
 */

import type { Metadata } from "next";
import EmployeeCorrectionsClient from "./EmployeeCorrectionsClient";

export const metadata: Metadata = { title: "Correction Requests" };

export default function EmployeeCorrectionsPage() {
  return <EmployeeCorrectionsClient />;
}
