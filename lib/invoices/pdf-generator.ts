/**
 * lib/invoices/pdf-generator.ts — Generate Invoice PDF with jsPDF
 */

import { jsPDF } from "jspdf";
import type { Invoice } from "@/types";

export function generateInvoicePdf(invoice: Invoice): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // ─── Header ───
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 175); // brand blue
  doc.text("AttendPay", margin, y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Employee Management System", margin, y + 7);

  // Invoice number + status right-aligned
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("INVOICE", pageWidth - margin, y, { align: "right" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`#${invoice.invoiceNumber}`, pageWidth - margin, y + 7, { align: "right" });

  const statusColors: Record<string, [number, number, number]> = {
    draft: [107, 114, 128],
    issued: [37, 99, 235],
    paid: [22, 163, 74],
    cancelled: [220, 38, 38],
  };
  const statusColor = statusColors[invoice.status] || [100, 100, 100];
  doc.setTextColor(...statusColor);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.status.toUpperCase(), pageWidth - margin, y + 13, { align: "right" });

  y += 25;

  // ─── Divider ───
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ─── Bill To / Invoice Details ───
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 100, 100);
  doc.text("BILL TO", margin, y);
  doc.text("INVOICE DETAILS", margin + contentWidth / 2, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(10);
  doc.text(invoice.employeeName, margin, y);

  const details = [
    ["Date:", new Date(invoice.createdAt).toLocaleDateString()],
    ["Period:", invoice.periodLabel],
    ["Type:", invoice.billingType.charAt(0).toUpperCase() + invoice.billingType.slice(1)],
    ["From:", invoice.periodStart],
    ["To:", invoice.periodEnd],
  ];

  let dy = y;
  for (const [label, value] of details) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(label, margin + contentWidth / 2, dy);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    doc.text(value, margin + contentWidth / 2 + 20, dy);
    dy += 5;
  }

  if (invoice.projectName) {
    dy += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("Project:", margin + contentWidth / 2, dy);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    doc.text(invoice.projectName, margin + contentWidth / 2 + 20, dy);
  }

  y = Math.max(y + 8, dy + 8);

  // ─── Line Items Table ───
  y += 5;
  const colWidths = [contentWidth * 0.45, contentWidth * 0.15, contentWidth * 0.2, contentWidth * 0.2];
  const colX = [margin, margin + colWidths[0], margin + colWidths[0] + colWidths[1], margin + colWidths[0] + colWidths[1] + colWidths[2]];

  // Table header
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y - 4, contentWidth, 8, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);

  const headers = ["Description", "Qty", "Unit Rate", "Amount"];
  headers.forEach((h, i) => {
    doc.text(h, colX[i] + 2, y);
  });

  y += 6;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // Table rows
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(9);

  for (const item of invoice.lineItems) {
    if (y > 260) {
      doc.addPage();
      y = margin;
    }

    doc.text(item.description.substring(0, 50), colX[0] + 2, y);
    doc.text(String(item.quantity), colX[1] + 2, y);
    doc.text(`$${item.unitRate.toFixed(2)}`, colX[2] + 2, y);
    doc.text(`$${item.amount.toFixed(2)}`, colX[3] + 2, y);
    y += 6;
  }

  y += 3;
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ─── Totals ───
  const totalsX = margin + contentWidth * 0.6;
  const totalsVX = pageWidth - margin;

  const totalLines: [string, string][] = [
    ["Subtotal:", `$${invoice.subtotal.toFixed(2)}`],
  ];
  if (invoice.tax > 0) totalLines.push(["Tax:", `$${invoice.tax.toFixed(2)}`]);
  if (invoice.discount > 0) totalLines.push(["Discount:", `-$${invoice.discount.toFixed(2)}`]);
  totalLines.push(["Total:", `$${invoice.total.toFixed(2)}`]);

  for (let i = 0; i < totalLines.length; i++) {
    const [label, value] = totalLines[i];
    const isTotal = i === totalLines.length - 1;

    doc.setFont("helvetica", isTotal ? "bold" : "normal");
    doc.setFontSize(isTotal ? 11 : 9);
    doc.setTextColor(isTotal ? 30 : 100, isTotal ? 30 : 100, isTotal ? 30 : 100);

    doc.text(label, totalsX, y);
    doc.text(value, totalsVX, y, { align: "right" });
    y += isTotal ? 8 : 5;
  }

  // ─── Notes ───
  if (invoice.notes) {
    y += 8;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("Notes:", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    const noteLines = doc.splitTextToSize(invoice.notes, contentWidth);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 4;
  }

  // ─── Footer ───
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Generated by AttendPay on ${new Date().toLocaleDateString()} | Currency: ${invoice.currency}`,
    pageWidth / 2,
    footerY,
    { align: "center" }
  );

  // Return as Buffer
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
