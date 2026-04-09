/**
 * app/api/reports/route.ts
 *
 * GET — Generate and download a report file.
 *
 * Query params:
 *   type       = "weekly-attendance" | "monthly-payroll" | "payroll-pdf" | "invoice-summary"
 *   period     = "2026-W15" or "2026-04"
 *   employeeId = (optional) filter to a single employee
 *
 * Returns the generated file as a download (xlsx or pdf).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, hasRole } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import type { AttendanceSession, PayrollRun, AppUser, Invoice } from "@/types";
import { msToDecimalHours } from "@/lib/attendance/utils";
import { minToHours } from "@/lib/payroll/utils";
import {
  parseWeekLabel,
  getWeekRange,
  parseMonthLabel,
  getMonthRange,
  dateRange,
} from "@/lib/timesheets/utils";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";

function errorJson(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

/** Apply thin borders to every cell in a row */
function applyBorders(row: ExcelJS.Row, colCount: number) {
  for (let c = 1; c <= colCount; c++) {
    row.getCell(c).border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !hasRole(session, "admin", "ceo")) {
    return errorJson("Admin or CEO access required.", 403);
  }

  const url = new URL(req.url);
  const type       = url.searchParams.get("type");
  const period     = url.searchParams.get("period");
  const employeeId = url.searchParams.get("employeeId") || undefined;

  if (!type || !period) {
    return errorJson("type and period are required.");
  }

  try {
    switch (type) {
      case "weekly-attendance":
        return await handleWeeklyAttendance(period, employeeId);
      case "monthly-payroll":
        return await handleMonthlyPayroll(period, employeeId);
      case "payroll-pdf":
        return await handlePayrollPdf(period, employeeId);
      case "invoice-summary":
        return await handleInvoiceSummary(period, employeeId);
      default:
        return errorJson(`Unknown report type: ${type}`);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Report generation failed.";
    console.error("Report error:", msg);
    return errorJson(msg, 500);
  }
}

// ── Weekly Attendance Excel ──────────────────────────────────

async function handleWeeklyAttendance(
  period: string,
  employeeId: string | undefined
) {
  const { year, week } = parseWeekLabel(period);
  const { start, end } = getWeekRange(year, week);
  const allDates = dateRange(start, end);

  // Single .where() max — date range filtering done in JS to avoid composite index.
  const sessionsSnap = await adminDb
    .collection("attendance_sessions")
    .where("status", "==", "completed")
    .limit(2000)
    .get();
  const sessions = sessionsSnap.docs
    .map((d) => d.data() as AttendanceSession)
    .filter((s) => s.date >= start && s.date <= end);

  // Group by employee
  const empMap = new Map<string, AttendanceSession[]>();
  for (const s of sessions) {
    if (employeeId && s.employeeId !== employeeId) continue;
    const list = empMap.get(s.employeeId) || [];
    list.push(s);
    empMap.set(s.employeeId, list);
  }

  // Fetch employee details
  const userSnap = await adminDb.collection("users").get();
  const userMap = new Map<string, AppUser>();
  for (const d of userSnap.docs) {
    const u = d.data() as AppUser;
    userMap.set(u.uid, u);
  }

  // Build workbook
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Attendance");

  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Set columns using Partial<Column> (only header/key/width)
  ws.columns = [
    { header: "Employee", key: "employee", width: 22 },
    { header: "Department", key: "department", width: 16 },
    ...dayLabels.map((d) => ({ header: d, key: d.toLowerCase(), width: 10 })),
    { header: "Total Work Hrs", key: "totalWork", width: 14 },
    { header: "Total Break Hrs", key: "totalBreak", width: 15 },
    { header: "Days Worked", key: "daysWorked", width: 12 },
  ];

  // Style header
  const hdr = ws.getRow(1);
  hdr.font = { bold: true, color: { argb: "FFFFFFFF" } };
  hdr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
  hdr.alignment = { horizontal: "center" };
  applyBorders(hdr, ws.columnCount);

  // Data rows
  for (const [empId, empSessions] of Array.from(empMap.entries())) {
    const user = userMap.get(empId);
    const byDate = new Map<string, AttendanceSession[]>();
    for (const s of empSessions) {
      (byDate.get(s.date) || (byDate.set(s.date, []), byDate.get(s.date)!)).push(s);
    }

    const rowData: Record<string, string | number> = {
      employee: user?.displayName || empSessions[0]?.employeeName || "Unknown",
      department: user?.department || "N/A",
    };

    let totalWork = 0;
    let totalBreak = 0;
    let daysWorked = 0;

    for (let i = 0; i < allDates.length && i < dayLabels.length; i++) {
      const daySess = byDate.get(allDates[i]) || [];
      if (daySess.length > 0) {
        const wh = parseFloat(msToDecimalHours(daySess.reduce((a, x) => a + x.totalWorkMs, 0)));
        rowData[dayLabels[i].toLowerCase()] = wh;
        totalWork += wh;
        totalBreak += parseFloat(msToDecimalHours(daySess.reduce((a, x) => a + x.totalBreakMs, 0)));
        daysWorked++;
      } else {
        rowData[dayLabels[i].toLowerCase()] = 0;
      }
    }

    rowData.totalWork = Math.round(totalWork * 100) / 100;
    rowData.totalBreak = Math.round(totalBreak * 100) / 100;
    rowData.daysWorked = daysWorked;

    const row = ws.addRow(rowData);
    applyBorders(row, ws.columnCount);
  }

  const buf = await workbook.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="attendance_${period}.xlsx"`,
    },
  });
}

// ── Monthly Payroll Excel ────────────────────────────────────

async function handleMonthlyPayroll(
  period: string,
  employeeId: string | undefined
) {
  const payrollSnap = await adminDb.collection("payroll_runs").where("period", "==", period).get();
  let runs = payrollSnap.docs.map((d) => d.data() as PayrollRun);
  if (employeeId) runs = runs.filter((r) => r.employeeId === employeeId);

  const userSnap = await adminDb.collection("users").get();
  const deptMap = new Map<string, string>();
  for (const d of userSnap.docs) {
    const u = d.data() as AppUser;
    deptMap.set(u.uid, u.department || "N/A");
  }

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Payroll");

  ws.columns = [
    { header: "Employee", key: "name", width: 22 },
    { header: "Department", key: "dept", width: 14 },
    { header: "Hourly Rate", key: "rate", width: 12 },
    { header: "Total Hrs", key: "totalHrs", width: 11 },
    { header: "Regular Hrs", key: "regHrs", width: 12 },
    { header: "OT Hrs", key: "otHrs", width: 10 },
    { header: "Regular Pay", key: "regPay", width: 12 },
    { header: "OT Pay", key: "otPay", width: 11 },
    { header: "Gross Pay", key: "gross", width: 12 },
    { header: "Deductions", key: "ded", width: 11 },
    { header: "Net Pay", key: "net", width: 12 },
    { header: "Status", key: "status", width: 10 },
  ];

  const hdr = ws.getRow(1);
  hdr.font = { bold: true, color: { argb: "FFFFFFFF" } };
  hdr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
  hdr.alignment = { horizontal: "center" };
  applyBorders(hdr, ws.columnCount);

  const totals = { totalHrs: 0, regHrs: 0, otHrs: 0, regPay: 0, otPay: 0, gross: 0, ded: 0, net: 0 };

  for (const r of runs) {
    const th = minToHours(r.totalWorkMin);
    const rh = minToHours(r.regularMin);
    const oh = minToHours(r.overtimeMin);

    totals.totalHrs += th; totals.regHrs += rh; totals.otHrs += oh;
    totals.regPay += r.regularPay; totals.otPay += r.overtimePay;
    totals.gross += r.grossPay; totals.ded += r.deductions; totals.net += r.netPay;

    const row = ws.addRow({
      name: r.employeeName, dept: deptMap.get(r.employeeId) || "N/A",
      rate: r.hourlyRate, totalHrs: th, regHrs: rh, otHrs: oh,
      regPay: r.regularPay, otPay: r.overtimePay, gross: r.grossPay,
      ded: r.deductions, net: r.netPay, status: r.status,
    });
    applyBorders(row, ws.columnCount);
  }

  // Totals row
  const tr = ws.addRow({
    name: "TOTALS", dept: "", rate: "",
    totalHrs: totals.totalHrs, regHrs: totals.regHrs, otHrs: totals.otHrs,
    regPay: totals.regPay, otPay: totals.otPay, gross: totals.gross,
    ded: totals.ded, net: totals.net, status: "",
  });
  tr.font = { bold: true };
  tr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7E6E6" } };
  applyBorders(tr, ws.columnCount);

  const buf = await workbook.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="payroll_${period}.xlsx"`,
    },
  });
}

// ── Payroll PDF ──────────────────────────────────────────────

async function handlePayrollPdf(
  period: string,
  employeeId: string | undefined
) {
  const payrollSnap = await adminDb.collection("payroll_runs").where("period", "==", period).get();
  let runs = payrollSnap.docs.map((d) => d.data() as PayrollRun);
  if (employeeId) runs = runs.filter((r) => r.employeeId === employeeId);

  const userSnap = await adminDb.collection("users").get();
  const deptMap = new Map<string, string>();
  for (const d of userSnap.docs) {
    const u = d.data() as AppUser;
    deptMap.set(u.uid, u.department || "N/A");
  }

  const runsData = runs.map((r) => ({
    name: r.employeeName,
    dept: deptMap.get(r.employeeId) || "N/A",
    hrs: minToHours(r.totalWorkMin).toFixed(1),
    regHrs: minToHours(r.regularMin).toFixed(1),
    otHrs: minToHours(r.overtimeMin).toFixed(1),
    regPay: "$" + r.regularPay.toFixed(2),
    otPay: "$" + r.overtimePay.toFixed(2),
    gross: "$" + r.grossPay.toFixed(2),
    ded: "$" + r.deductions.toFixed(2),
    net: "$" + r.netPay.toFixed(2),
  }));

  const totals = {
    hrs: runs.reduce((s, r) => s + minToHours(r.totalWorkMin), 0),
    gross: runs.reduce((s, r) => s + r.grossPay, 0),
    net: runs.reduce((s, r) => s + r.netPay, 0),
  };

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pw = doc.internal.pageSize.getWidth();
  let y = 15;

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 175);
  doc.text("AgencyDesk — Payroll Summary", pw / 2, y, { align: "center" });
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`Period: ${period}  |  Generated: ${new Date().toLocaleDateString()}`, pw / 2, y, { align: "center" });
  y += 10;

  // Table
  const cols = ["Employee", "Dept", "Hours", "Reg Hrs", "OT Hrs", "Reg Pay", "OT Pay", "Gross", "Deduct", "Net Pay"];
  const cw = [40, 25, 18, 18, 18, 25, 22, 25, 22, 25];
  let x = 15;

  // Header row
  doc.setFillColor(30, 64, 175);
  doc.rect(x, y - 4, cw.reduce((a, b) => a + b, 0), 7, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  for (let i = 0; i < cols.length; i++) {
    doc.text(cols[i], x + 1, y);
    x += cw[i];
  }
  y += 5;

  // Data rows
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(8);

  for (let ri = 0; ri < runsData.length; ri++) {
    if (y > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      y = 15;
    }

    if (ri % 2 === 0) {
      doc.setFillColor(245, 247, 250);
      doc.rect(15, y - 3.5, cw.reduce((a, b) => a + b, 0), 5, "F");
    }

    x = 15;
    const r = runsData[ri];
    const vals = [r.name, r.dept, r.hrs, r.regHrs, r.otHrs, r.regPay, r.otPay, r.gross, r.ded, r.net];
    for (let i = 0; i < vals.length; i++) {
      doc.text(String(vals[i]).substring(0, 22), x + 1, y);
      x += cw[i];
    }
    y += 5;
  }

  // Totals
  y += 2;
  doc.setFont("helvetica", "bold");
  doc.setFillColor(226, 232, 240);
  doc.rect(15, y - 3.5, cw.reduce((a, b) => a + b, 0), 5, "F");
  doc.text(`TOTALS — ${totals.hrs.toFixed(1)} hrs — Gross: $${totals.gross.toFixed(2)} — Net: $${totals.net.toFixed(2)}`, 16, y);

  // Footer
  const fh = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.text("Generated by AgencyDesk", pw / 2, fh - 5, { align: "center" });

  const ab = doc.output("arraybuffer");
  return new NextResponse(Buffer.from(ab), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="payroll_summary_${period}.pdf"`,
    },
  });
}

// ── Invoice Summary Excel ────────────────────────────────────

async function handleInvoiceSummary(
  period: string,
  employeeId: string | undefined
) {
  let q: FirebaseFirestore.Query = adminDb.collection("invoices");
  if (employeeId) q = q.where("userId", "==", employeeId);

  const snap = await q.get();
  const invoices = snap.docs.map((d) => d.data() as Invoice);

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Invoice Summary");

  ws.columns = [
    { header: "Invoice #", key: "num", width: 18 },
    { header: "Employee", key: "emp", width: 22 },
    { header: "Type", key: "type", width: 14 },
    { header: "Period", key: "period", width: 14 },
    { header: "Subtotal", key: "sub", width: 12 },
    { header: "Tax", key: "tax", width: 10 },
    { header: "Discount", key: "disc", width: 11 },
    { header: "Total", key: "total", width: 12 },
    { header: "Status", key: "status", width: 10 },
    { header: "Created", key: "created", width: 14 },
  ];

  const hdr = ws.getRow(1);
  hdr.font = { bold: true, color: { argb: "FFFFFFFF" } };
  hdr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
  hdr.alignment = { horizontal: "center" };
  applyBorders(hdr, ws.columnCount);

  let tSub = 0, tTax = 0, tDisc = 0, tTotal = 0;

  for (const inv of invoices) {
    tSub += inv.subtotal; tTax += inv.tax; tDisc += inv.discount; tTotal += inv.total;

    const row = ws.addRow({
      num: inv.invoiceNumber,
      emp: inv.employeeName,
      type: inv.billingType,
      period: inv.periodLabel,
      sub: inv.subtotal,
      tax: inv.tax,
      disc: inv.discount,
      total: inv.total,
      status: inv.status,
      created: new Date(inv.createdAt).toLocaleDateString(),
    });
    applyBorders(row, ws.columnCount);
  }

  const tr = ws.addRow({
    num: "", emp: "TOTALS", type: "", period: "",
    sub: tSub, tax: tTax, disc: tDisc, total: tTotal,
    status: "", created: "",
  });
  tr.font = { bold: true };
  tr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7E6E6" } };
  applyBorders(tr, ws.columnCount);

  const buf = await workbook.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="invoice_summary_${period}.xlsx"`,
    },
  });
}
