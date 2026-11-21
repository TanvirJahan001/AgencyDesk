import type { Metadata } from "next";
import DashboardShell from "@/components/layout/DashboardShell";

export const metadata: Metadata = {
  title: "Live Admin Demo",
  description: "Explore AgencyDesk’s admin dashboard with read-only sample data.",
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell demo>{children}</DashboardShell>;
}
