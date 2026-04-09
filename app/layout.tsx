/**
 * app/layout.tsx — Root Layout
 *
 * Wraps every route. Adds base HTML shell, font, and global CSS.
 * No auth logic here — that lives in the (dashboard) group layout
 * and in middleware.ts.
 */

import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s | AgencyDesk",
    default:  "AgencyDesk",
  },
  description: "Agency management system — attendance, payroll, projects, invoices & more",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* Inter font loaded via CSS — swap for next/font/google if preferred */}
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
