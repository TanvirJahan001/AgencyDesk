/**
 * app/api/payslips/[id]/download/route.ts
 *
 * GET: Generate and download a PDF payslip
 *
 * Auth: Must be admin/CEO OR the employee who owns the payslip
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import { unauthorized, forbidden, notFound, serverError } from "@/lib/api/helpers";
import type { Payslip } from "@/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized("Authentication required");

  try {
    const { id } = await params;

    // Fetch the payslip
    const payslipDoc = await adminDb.collection("payslips").doc(id).get();
    if (!payslipDoc.exists) {
      return notFound("Payslip not found");
    }

    const payslip = payslipDoc.data() as Payslip;

    // Access control: own payslip or admin/CEO
    if (!hasRole(session, "admin", "ceo") && payslip.employeeId !== session.uid) {
      return forbidden("You cannot access this payslip");
    }

    // Generate PDF
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    let y = 15;

    // ─── Header ──────────────────────────────────────────────────

    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 64, 175);
    doc.text("AgencyDesk", pw / 2, y, { align: "center" });
    y += 8;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("PAYSLIP", pw / 2, y, { align: "center" });
    y += 12;

    // ─── Employee Info ───────────────────────────────────────────

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);

    const infoLineHeight = 5.5;
    const leftCol = 15;
    const rightCol = pw / 2 + 5;

    doc.text(`Employee Name: ${payslip.employeeName}`, leftCol, y);
    doc.text(`Period: ${payslip.period}`, rightCol, y);
    y += infoLineHeight;

    doc.text(`Employee ID: ${payslip.employeeId}`, leftCol, y);
    doc.text(
      `Period Range: ${payslip.periodStart} to ${payslip.periodEnd}`,
      rightCol,
      y
    );
    y += infoLineHeight;

    if (payslip.department) {
      doc.text(`Department: ${payslip.department}`, leftCol, y);
    }
    if (payslip.position) {
      doc.text(`Position: ${payslip.position}`, rightCol, y);
    }
    y += infoLineHeight + 2;

    // ─── Earnings Table ──────────────────────────────────────────

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(30, 64, 175);

    const tableStartY = y;
    const tableWidth = pw - 30;
    const col1Width = 80;
    const col2Width = 35;
    const col3Width = 30;
    const col4Width = tableWidth - col1Width - col2Width - col3Width;

    // Header row
    doc.rect(leftCol, y - 4, tableWidth, 6, "F");
    doc.text("Description", leftCol + 2, y);
    doc.text("Hours", leftCol + col1Width + 2, y);
    doc.text("Rate", leftCol + col1Width + col2Width + 2, y);
    doc.text("Amount", leftCol + col1Width + col2Width + col3Width + 2, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(9);

    // Data rows
    const rows = [
      {
        desc: "Regular Hours",
        hours: payslip.regularHours.toFixed(2),
        rate: `$${(payslip.regularPay / payslip.regularHours).toFixed(2)}`,
        amount: `$${payslip.regularPay.toFixed(2)}`,
      },
      {
        desc: "Overtime Hours",
        hours: payslip.overtimeHours.toFixed(2),
        rate: payslip.overtimeHours > 0 ? `$${(payslip.overtimePay / payslip.overtimeHours).toFixed(2)}` : "$0.00",
        amount: `$${payslip.overtimePay.toFixed(2)}`,
      },
    ];

    for (const row of rows) {
      // Alternating row background
      if (rows.indexOf(row) % 2 === 0) {
        doc.setFillColor(245, 247, 250);
        doc.rect(leftCol, y - 3.5, tableWidth, 5, "F");
      }

      doc.text(row.desc, leftCol + 2, y);
      doc.text(row.hours, leftCol + col1Width + 2, y);
      doc.text(row.rate, leftCol + col1Width + col2Width + 2, y);
      doc.text(row.amount, leftCol + col1Width + col2Width + col3Width + 2, y);
      y += 5;
    }

    // Gross pay row (bold)
    doc.setFont("helvetica", "bold");
    doc.setFillColor(226, 232, 240);
    doc.rect(leftCol, y - 3.5, tableWidth, 5, "F");
    doc.text("Gross Pay", leftCol + 2, y);
    doc.text("", leftCol + col1Width + 2, y);
    doc.text("", leftCol + col1Width + col2Width + 2, y);
    doc.text(`$${payslip.grossPay.toFixed(2)}`, leftCol + col1Width + col2Width + col3Width + 2, y);
    y += 6;

    // ─── Deductions Table ────────────────────────────────────────

    if (payslip.deductions.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.setFillColor(220, 38, 38);
      doc.setFontSize(10);

      doc.rect(leftCol, y - 4, tableWidth, 6, "F");
      doc.text("Deductions", leftCol + 2, y);
      doc.text("Amount", leftCol + tableWidth - 30, y);
      y += 6;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(9);

      for (let i = 0; i < payslip.deductions.length; i++) {
        const ded = payslip.deductions[i];

        if (i % 2 === 0) {
          doc.setFillColor(254, 242, 242);
          doc.rect(leftCol, y - 3.5, tableWidth, 5, "F");
        }

        doc.text(ded.name, leftCol + 2, y);
        doc.text(`$${ded.amount.toFixed(2)}`, leftCol + tableWidth - 30, y);
        y += 5;
      }

      // Total deductions row
      doc.setFont("helvetica", "bold");
      doc.setFillColor(242, 242, 242);
      doc.rect(leftCol, y - 3.5, tableWidth, 5, "F");
      doc.text("Total Deductions", leftCol + 2, y);
      doc.text(`$${payslip.totalDeductions.toFixed(2)}`, leftCol + tableWidth - 30, y);
      y += 6;
    }

    // ─── Net Pay Box ─────────────────────────────────────────────

    y += 2;
    doc.setFillColor(30, 64, 175);
    doc.rect(leftCol, y - 4, tableWidth, 12, "F");

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("Net Pay", leftCol + 2, y + 2);
    doc.text(`$${payslip.netPay.toFixed(2)}`, leftCol + tableWidth - 15, y + 2, { align: "right" });
    y += 12;

    // ─── Footer ──────────────────────────────────────────────────

    y = ph - 15;
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text("Generated by AgencyDesk | Confidential", pw / 2, y, { align: "center" });

    const now = new Date();
    doc.text(
      `Generated on ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`,
      pw / 2,
      y + 4,
      { align: "center" }
    );

    // Generate PDF buffer and return
    const ab = doc.output("arraybuffer");
    return new NextResponse(Buffer.from(ab), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="payslip_${payslip.employeeName.replace(/\s+/g, "_")}_${payslip.period}.pdf"`,
      },
    });
  } catch (err) {
    return serverError(err);
  }
}
