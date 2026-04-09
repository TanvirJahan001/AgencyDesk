/**
 * scripts/seed-firestore.mjs — Full Firestore Seed Script
 *
 * Populates ALL 13 collections with realistic sample data:
 *   users, attendance_sessions, attendance_segments, payroll_runs,
 *   timesheets, payroll_locks, correction_requests, audit_logs,
 *   notifications, invoices, missed_checkouts, cron_runs
 *
 * Run with:   npm run seed
 *
 * Creates:
 *   - 1 Admin user  (admin@attendpay.com / Admin@123)
 *   - 1 CEO user    (ceo@attendpay.com / Ceo@12345)
 *   - 5 Employees   (emp1–emp5@attendpay.com / Employee@123)
 *   - 3 weeks of attendance data per employee
 *   - Timesheets, payroll runs, invoices, notifications, etc.
 *
 * Safe to re-run — uses { merge: true } for user docs.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// ── Load .env.local & extract service account JSON directly ──

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");

let serviceAccount;
try {
  const envContent = readFileSync(envPath, "utf-8");
  // Find the FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON line and grab everything after the first =
  const match = envContent.match(/FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON\s*=\s*(.+)/);
  if (!match) {
    throw new Error("FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON not found in .env.local");
  }
  let jsonStr = match[1].trim();
  // Strip surrounding quotes if present
  if ((jsonStr.startsWith('"') && jsonStr.endsWith('"')) ||
      (jsonStr.startsWith("'") && jsonStr.endsWith("'"))) {
    jsonStr = jsonStr.slice(1, -1);
  }
  serviceAccount = JSON.parse(jsonStr);
  console.log("✓ Loaded service account for project:", serviceAccount.project_id);
} catch (err) {
  console.error("Failed to load Firebase credentials:", err.message);
  process.exit(1);
}

if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });

const auth = getAuth();
const db   = getFirestore();

// ── Helpers ──────────────────────────────────────────────────

function genId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function iso(date) { return date.toISOString(); }

function dateStr(date) { return date.toISOString().slice(0, 10); }

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function setTime(date, h, m, s = 0) {
  const d = new Date(date);
  d.setHours(h, m, s, 0);
  return d;
}

function diffMin(start, end) {
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}

function weekLabel(date) {
  const { year, week } = getISOWeek(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function monthLabel(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// ── Test data definitions ────────────────────────────────────

const TEST_USERS = [
  {
    email: "admin@attendpay.com", password: "Admin@123",
    displayName: "Sarah Admin", role: "admin",
    department: "Management", position: "System Administrator",
    hourlyRate: 45, overtimeMultiplier: 1.5,
    payType: "monthly", salaryAmount: 7500,
  },
  {
    email: "ceo@attendpay.com", password: "Ceo@12345",
    displayName: "Michael CEO", role: "ceo",
    department: "Executive", position: "Chief Executive Officer",
    hourlyRate: 100, overtimeMultiplier: 1.5,
    payType: "monthly", salaryAmount: 15000,
  },
  {
    email: "emp1@attendpay.com", password: "Employee@123",
    displayName: "John Smith", role: "employee",
    department: "IT", position: "Developer",
    hourlyRate: 35, overtimeMultiplier: 1.5,
    payType: "hourly", salaryAmount: 35,
  },
  {
    email: "emp2@attendpay.com", password: "Employee@123",
    displayName: "Emily Chen", role: "employee",
    department: "HR", position: "HR Specialist",
    hourlyRate: 30, overtimeMultiplier: 1.5,
    payType: "monthly", salaryAmount: 5200,
  },
  {
    email: "emp3@attendpay.com", password: "Employee@123",
    displayName: "David Lee", role: "employee",
    department: "Finance", position: "Accountant",
    hourlyRate: 32, overtimeMultiplier: 1.5,
    payType: "bi-weekly", salaryAmount: 2500,
  },
  {
    email: "emp4@attendpay.com", password: "Employee@123",
    displayName: "Maria Garcia", role: "employee",
    department: "Marketing", position: "Designer",
    hourlyRate: 28, overtimeMultiplier: 1.5,
    payType: "weekly", salaryAmount: 1120,
  },
  {
    email: "emp5@attendpay.com", password: "Employee@123",
    displayName: "Alex Johnson", role: "employee",
    department: "Sales", position: "Sales Rep",
    hourlyRate: 25, overtimeMultiplier: 1.5,
    payType: "hourly", salaryAmount: 25,
  },
];

// ── Main seed function ───────────────────────────────────────

async function seed() {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║    AgencyDesk — Full Database Seed       ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const now = new Date();
  const createdUsers = [];

  // ════════════════════════════════════════════════════════════
  // 1. USERS — Create Auth + Firestore profiles
  // ════════════════════════════════════════════════════════════
  console.log("┌─ 1. Creating users ────────────────────");

  for (const u of TEST_USERS) {
    let uid;
    try {
      const existing = await auth.getUserByEmail(u.email);
      uid = existing.uid;
      console.log(`│  ✓ Exists: ${u.email} (${uid})`);
    } catch {
      const created = await auth.createUser({
        email: u.email, password: u.password, displayName: u.displayName,
      });
      uid = created.uid;
      console.log(`│  + Created: ${u.email} (${uid})`);
    }

    const userDoc = {
      uid, email: u.email, displayName: u.displayName,
      role: u.role, department: u.department, position: u.position,
      hourlyRate: u.hourlyRate, overtimeMultiplier: u.overtimeMultiplier,
      weeklyOvertimeThresholdMin: 2400,
      payType: u.payType, salaryAmount: u.salaryAmount,
      createdAt: iso(now),
    };
    await db.collection("users").doc(uid).set(userDoc, { merge: true });
    createdUsers.push({ ...u, uid });
  }

  const admin = createdUsers.find(u => u.role === "admin");
  const employees = createdUsers.filter(u => u.role === "employee");
  console.log(`└─ ${createdUsers.length} users ready\n`);

  // ════════════════════════════════════════════════════════════
  // 2. ATTENDANCE SESSIONS + SEGMENTS (V2 schema)
  // ════════════════════════════════════════════════════════════
  console.log("┌─ 2. Creating attendance sessions ──────");

  const allSessions = [];
  const allSegments = [];

  // Create 15 business days of attendance for each employee (3 weeks back)
  for (const emp of employees) {
    let dayCount = 0;
    for (let d = -21; d <= -1 && dayCount < 15; d++) {
      const date = addDays(now, d);
      const dow = date.getDay();
      if (dow === 0 || dow === 6) continue; // skip weekends
      dayCount++;

      // Randomize times slightly
      const clockInH = 8 + Math.floor(Math.random() * 2);
      const clockInM = Math.floor(Math.random() * 30);
      const clockIn = setTime(date, clockInH, clockInM);

      const clockOutH = 16 + Math.floor(Math.random() * 2);
      const clockOutM = Math.floor(Math.random() * 45);
      const clockOut = setTime(date, clockOutH, clockOutM);

      // Break: 30-60 min starting at 12:00-13:00
      const breakStartH = 12 + Math.floor(Math.random() * 1);
      const breakStartM = Math.floor(Math.random() * 30);
      const breakStart = setTime(date, breakStartH, breakStartM);
      const breakDurMin = 30 + Math.floor(Math.random() * 30);
      const breakEnd = new Date(breakStart.getTime() + breakDurMin * 60000);

      const workMin1 = diffMin(clockIn, breakStart);
      const workMin2 = diffMin(breakEnd, clockOut);
      const totalWorkMin = workMin1 + workMin2;
      const totalBreakMin = breakDurMin;
      const overtimeMin = Math.max(0, totalWorkMin - 480); // 8h daily

      const sessionId = genId("sess");
      const ds = dateStr(date);

      const session = {
        id: sessionId, userId: emp.uid, userName: emp.displayName,
        workDate: ds, status: "completed",
        clockInAt: iso(clockIn), clockOutAt: iso(clockOut),
        totalWorkMinutes: totalWorkMin, totalBreakMinutes: totalBreakMin,
        overtimeMinutes: overtimeMin, approvedStatus: "approved",
        createdAt: iso(clockIn), updatedAt: iso(clockOut),
      };
      allSessions.push(session);

      // Segments: work1 → break → work2
      const seg1 = {
        id: genId("seg"), sessionId, userId: emp.uid, type: "work",
        startAt: iso(clockIn), endAt: iso(breakStart),
        durationMinutes: workMin1, isOpen: false, createdAt: iso(clockIn),
      };
      const seg2 = {
        id: genId("seg"), sessionId, userId: emp.uid, type: "break",
        startAt: iso(breakStart), endAt: iso(breakEnd),
        durationMinutes: breakDurMin, isOpen: false, createdAt: iso(breakStart),
      };
      const seg3 = {
        id: genId("seg"), sessionId, userId: emp.uid, type: "work",
        startAt: iso(breakEnd), endAt: iso(clockOut),
        durationMinutes: workMin2, isOpen: false, createdAt: iso(breakEnd),
      };
      allSegments.push(seg1, seg2, seg3);
    }
  }

  // Batch write sessions
  for (const s of allSessions) {
    await db.collection("attendance_sessions").doc(s.id).set(s);
  }
  console.log(`│  + ${allSessions.length} sessions created`);

  // Batch write segments
  for (const seg of allSegments) {
    await db.collection("attendance_segments").doc(seg.id).set(seg);
  }
  console.log(`│  + ${allSegments.length} segments created`);
  console.log("└─ Done\n");

  // ════════════════════════════════════════════════════════════
  // 3. TIMESHEETS
  // ════════════════════════════════════════════════════════════
  console.log("┌─ 3. Creating timesheets ───────────────");

  const allTimesheets = [];
  const weekAgo = addDays(now, -7);
  const wl = weekLabel(weekAgo);
  const ml = monthLabel(now);

  for (const emp of employees) {
    const empSessions = allSessions.filter(s => s.userId === emp.uid);

    // Weekly timesheet
    const wStart = addDays(weekAgo, -(weekAgo.getDay() === 0 ? 6 : weekAgo.getDay() - 1));
    const wEnd = addDays(wStart, 6);
    const weekSessions = empSessions.filter(s => s.workDate >= dateStr(wStart) && s.workDate <= dateStr(wEnd));

    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = dateStr(addDays(wStart, i));
      const daySess = weekSessions.filter(s => s.workDate === d);
      weekDays.push({
        date: d,
        sessionIds: daySess.map(s => s.id),
        totalWorkMs: daySess.reduce((a, s) => a + s.totalWorkMinutes * 60000, 0),
        totalBreakMs: daySess.reduce((a, s) => a + s.totalBreakMinutes * 60000, 0),
        status: daySess.length > 0 ? "completed" : "absent",
      });
    }

    const tsId = genId("ts");
    const weeklyTs = {
      id: tsId, employeeId: emp.uid, employeeName: emp.displayName,
      periodType: "weekly", periodLabel: wl,
      periodStart: dateStr(wStart), periodEnd: dateStr(wEnd),
      days: weekDays,
      totalWorkMs: weekDays.reduce((a, d) => a + d.totalWorkMs, 0),
      totalBreakMs: weekDays.reduce((a, d) => a + d.totalBreakMs, 0),
      totalDaysWorked: weekDays.filter(d => d.status !== "absent").length,
      status: "approved", submittedAt: iso(addDays(wEnd, 1)),
      reviewedBy: admin.uid, reviewerName: admin.displayName,
      reviewNote: "Looks good.", reviewedAt: iso(addDays(wEnd, 2)),
      locked: false, lockedAt: null, lockedBy: null,
      createdAt: iso(wStart), updatedAt: iso(addDays(wEnd, 2)),
    };
    allTimesheets.push(weeklyTs);

    // Monthly timesheet
    const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthSessions = empSessions.filter(s => s.workDate >= dateStr(mStart) && s.workDate <= dateStr(mEnd));

    const monthDays = [];
    for (let i = 0; i < mEnd.getDate(); i++) {
      const d = dateStr(addDays(mStart, i));
      const daySess = monthSessions.filter(s => s.workDate === d);
      monthDays.push({
        date: d,
        sessionIds: daySess.map(s => s.id),
        totalWorkMs: daySess.reduce((a, s) => a + s.totalWorkMinutes * 60000, 0),
        totalBreakMs: daySess.reduce((a, s) => a + s.totalBreakMinutes * 60000, 0),
        status: daySess.length > 0 ? "completed" : "absent",
      });
    }

    const mtsId = genId("ts");
    const monthlyTs = {
      id: mtsId, employeeId: emp.uid, employeeName: emp.displayName,
      periodType: "monthly", periodLabel: ml,
      periodStart: dateStr(mStart), periodEnd: dateStr(mEnd),
      days: monthDays,
      totalWorkMs: monthDays.reduce((a, d) => a + d.totalWorkMs, 0),
      totalBreakMs: monthDays.reduce((a, d) => a + d.totalBreakMs, 0),
      totalDaysWorked: monthDays.filter(d => d.status !== "absent").length,
      status: "submitted", submittedAt: iso(now),
      reviewedBy: null, reviewerName: null, reviewNote: null, reviewedAt: null,
      locked: false, lockedAt: null, lockedBy: null,
      createdAt: iso(mStart), updatedAt: iso(now),
    };
    allTimesheets.push(monthlyTs);
  }

  for (const ts of allTimesheets) {
    await db.collection("timesheets").doc(ts.id).set(ts);
  }
  console.log(`│  + ${allTimesheets.length} timesheets created`);
  console.log("└─ Done\n");

  // ════════════════════════════════════════════════════════════
  // 4. PAYROLL RUNS
  // ════════════════════════════════════════════════════════════
  console.log("┌─ 4. Creating payroll runs ─────────────");

  const allPayroll = [];
  for (const emp of employees) {
    const empSessions = allSessions.filter(s => s.userId === emp.uid);
    const totalWorkMin = empSessions.reduce((a, s) => a + s.totalWorkMinutes, 0);
    const otMin = Math.max(0, totalWorkMin - 2400); // 40h weekly threshold
    const regMin = totalWorkMin - otMin;

    const regPay = Math.round((regMin / 60) * emp.hourlyRate * 100) / 100;
    const otPay = Math.round((otMin / 60) * emp.hourlyRate * emp.overtimeMultiplier * 100) / 100;
    const grossPay = regPay + otPay;
    const deductions = Math.round(grossPay * 0.15 * 100) / 100; // 15% deductions
    const netPay = Math.round((grossPay - deductions) * 100) / 100;

    const dailyBreakdown = [];
    const dateMap = new Map();
    for (const s of empSessions) {
      const existing = dateMap.get(s.workDate) || { date: s.workDate, workMin: 0, sessionIds: [] };
      existing.workMin += s.totalWorkMinutes;
      existing.sessionIds.push(s.id);
      dateMap.set(s.workDate, existing);
    }
    for (const entry of dateMap.values()) {
      dailyBreakdown.push(entry);
    }

    const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const prId = genId("pr");
    const payrollRun = {
      id: prId, employeeId: emp.uid, employeeName: emp.displayName,
      period: ml, periodType: "monthly",
      periodStart: dateStr(mStart), periodEnd: dateStr(mEnd),
      timesheetId: allTimesheets.find(t => t.employeeId === emp.uid && t.periodType === "monthly")?.id || null,
      hourlyRate: emp.hourlyRate, overtimeMultiplier: emp.overtimeMultiplier,
      weeklyOtThresholdMin: 2400,
      totalWorkMin, regularMin: regMin, overtimeMin: otMin,
      regularPay: regPay, overtimePay: otPay, grossPay,
      deductions, netPay,
      dailyBreakdown,
      status: "processed",
      calculatedAt: iso(now), processedAt: iso(now), paidAt: null,
      createdBy: admin.uid, createdByName: admin.displayName,
      createdAt: iso(now), updatedAt: iso(now),
    };
    allPayroll.push(payrollRun);
  }

  for (const pr of allPayroll) {
    await db.collection("payroll_runs").doc(pr.id).set(pr);
  }
  console.log(`│  + ${allPayroll.length} payroll runs created`);
  console.log("└─ Done\n");

  // ════════════════════════════════════════════════════════════
  // 5. INVOICES
  // ════════════════════════════════════════════════════════════
  console.log("┌─ 5. Creating invoices ─────────────────");

  const allInvoices = [];
  let invoiceSeq = 1;

  for (const emp of employees) {
    const pr = allPayroll.find(p => p.employeeId === emp.uid);
    if (!pr) continue;

    const invId = genId("inv");
    const invNum = `INV-${now.getFullYear()}-${String(invoiceSeq++).padStart(4, "0")}`;

    const lineItems = [];
    const regHours = Math.round((pr.regularMin / 60) * 100) / 100;
    if (regHours > 0) {
      lineItems.push({
        description: "Regular work hours",
        quantity: regHours,
        unitRate: emp.hourlyRate,
        amount: Math.round(regHours * emp.hourlyRate * 100) / 100,
      });
    }
    const otHours = Math.round((pr.overtimeMin / 60) * 100) / 100;
    if (otHours > 0) {
      lineItems.push({
        description: "Overtime hours",
        quantity: otHours,
        unitRate: Math.round(emp.hourlyRate * emp.overtimeMultiplier * 100) / 100,
        amount: Math.round(otHours * emp.hourlyRate * emp.overtimeMultiplier * 100) / 100,
      });
    }

    const subtotal = lineItems.reduce((a, li) => a + li.amount, 0);
    const tax = Math.round(subtotal * 0.05 * 100) / 100; // 5% tax
    const total = Math.round((subtotal + tax) * 100) / 100;

    const invoice = {
      id: invId, invoiceNumber: invNum,
      userId: emp.uid, employeeName: emp.displayName,
      billingType: emp.payType || "hourly",
      periodLabel: ml,
      periodStart: pr.periodStart, periodEnd: pr.periodEnd,
      projectId: null, projectName: null,
      lineItems, subtotal, tax, discount: 0, total,
      currency: "USD",
      status: invoiceSeq <= 3 ? "issued" : "draft",
      notes: null, generatedBy: admin.uid,
      createdAt: iso(now), updatedAt: iso(now), paidAt: null,
    };
    allInvoices.push(invoice);
  }

  for (const inv of allInvoices) {
    await db.collection("invoices").doc(inv.id).set(inv);
  }
  console.log(`│  + ${allInvoices.length} invoices created`);
  console.log("└─ Done\n");

  // ════════════════════════════════════════════════════════════
  // 6. CORRECTION REQUESTS + AUDIT LOGS
  // ════════════════════════════════════════════════════════════
  console.log("┌─ 6. Creating corrections + audit logs ─");

  const emp1 = employees[0];
  const emp1Sessions = allSessions.filter(s => s.userId === emp1.uid);

  // 1 approved, 1 pending, 1 rejected
  const correctionData = [
    {
      status: "approved", reviewNote: "Clock-in time verified with badge system.",
      changes: [{ field: "clockIn", oldValue: emp1Sessions[0]?.clockInAt?.slice(0,16) || "", newValue: "2026-03-25T08:45" }],
    },
    {
      status: "pending", reviewNote: null,
      changes: [{ field: "clockOut", oldValue: emp1Sessions[1]?.clockOutAt?.slice(0,16) || "", newValue: "2026-03-26T18:30" }],
    },
    {
      status: "rejected", reviewNote: "Cannot verify — no badge record found.",
      changes: [{ field: "status", oldValue: "completed", newValue: "missed_checkout" }],
    },
  ];

  const corrections = [];
  const auditLogs = [];

  for (let i = 0; i < correctionData.length && i < emp1Sessions.length; i++) {
    const cd = correctionData[i];
    const sess = emp1Sessions[i];
    const corrId = genId("corr");
    const corrNow = iso(addDays(now, -5 + i));

    const correction = {
      id: corrId, sessionId: sess.id,
      employeeId: emp1.uid, employeeName: emp1.displayName,
      sessionDate: sess.workDate,
      reason: "I forgot to clock in/out properly that day. Badge logs should confirm my presence.",
      changes: cd.changes,
      status: cd.status,
      reviewedBy: cd.status !== "pending" ? admin.uid : null,
      reviewerName: cd.status !== "pending" ? admin.displayName : null,
      reviewNote: cd.reviewNote,
      reviewedAt: cd.status !== "pending" ? iso(addDays(now, -4 + i)) : null,
      createdAt: corrNow, updatedAt: iso(addDays(now, -4 + i)),
    };
    corrections.push(correction);
    await db.collection("correction_requests").doc(corrId).set(correction);

    // Audit log for approved/rejected
    if (cd.status !== "pending") {
      const logId = genId("audit");
      const auditLog = {
        id: logId,
        type: cd.status === "approved" ? "correction_approved" : "correction_rejected",
        correctionId: corrId, sessionId: sess.id,
        employeeId: emp1.uid, adminId: admin.uid, adminName: admin.displayName,
        changes: cd.changes,
        note: cd.reviewNote,
        timestamp: iso(addDays(now, -4 + i)),
      };
      auditLogs.push(auditLog);
      await db.collection("audit_logs").doc(logId).set(auditLog);
    }
  }

  console.log(`│  + ${corrections.length} corrections, ${auditLogs.length} audit logs`);
  console.log("└─ Done\n");

  // ════════════════════════════════════════════════════════════
  // 7. MISSED CHECKOUTS
  // ════════════════════════════════════════════════════════════
  console.log("┌─ 7. Creating missed checkouts ─────────");

  // Create 1 resolved and 1 pending missed checkout
  const mcEmployee = employees[4]; // Alex Johnson
  const mcSessions = allSessions.filter(s => s.userId === mcEmployee.uid);

  const missedCheckouts = [];

  if (mcSessions.length >= 2) {
    // Pending
    const mc1 = {
      id: genId("mc"), sessionId: mcSessions[0].id,
      employeeId: mcEmployee.uid, employeeName: mcEmployee.displayName,
      sessionDate: mcSessions[0].workDate,
      startTime: mcSessions[0].clockInAt,
      detectedAt: iso(addDays(now, -1)),
      resolution: "pending",
      resolvedBy: null, resolvedByName: null, resolvedAt: null,
      adjustedEndTime: null, note: null,
      createdAt: iso(addDays(now, -1)), updatedAt: iso(addDays(now, -1)),
    };
    missedCheckouts.push(mc1);

    // Resolved
    const mc2 = {
      id: genId("mc"), sessionId: mcSessions[1].id,
      employeeId: mcEmployee.uid, employeeName: mcEmployee.displayName,
      sessionDate: mcSessions[1].workDate,
      startTime: mcSessions[1].clockInAt,
      detectedAt: iso(addDays(now, -3)),
      resolution: "admin_adjusted",
      resolvedBy: admin.uid, resolvedByName: admin.displayName,
      resolvedAt: iso(addDays(now, -2)),
      adjustedEndTime: iso(setTime(new Date(mcSessions[1].workDate), 17, 30)),
      note: "Employee confirmed they left at 5:30 PM.",
      createdAt: iso(addDays(now, -3)), updatedAt: iso(addDays(now, -2)),
    };
    missedCheckouts.push(mc2);
  }

  for (const mc of missedCheckouts) {
    await db.collection("missed_checkouts").doc(mc.id).set(mc);
  }
  console.log(`│  + ${missedCheckouts.length} missed checkouts`);
  console.log("└─ Done\n");

  // ════════════════════════════════════════════════════════════
  // 8. NOTIFICATIONS
  // ════════════════════════════════════════════════════════════
  console.log("┌─ 8. Creating notifications ────────────");

  const notifications = [
    // For emp1 — correction approved
    {
      id: genId("notif"), userId: emp1.uid, type: "correction_approved",
      title: "Correction Approved", message: "Your clock-in correction for March 25 has been approved.",
      read: false, linkTo: "/employee/corrections", relatedId: corrections[0]?.id || null,
      createdAt: iso(addDays(now, -4)),
    },
    // For emp1 — correction rejected
    {
      id: genId("notif"), userId: emp1.uid, type: "correction_rejected",
      title: "Correction Rejected", message: "Your status change request has been rejected. See admin notes for details.",
      read: true, linkTo: "/employee/corrections", relatedId: corrections[2]?.id || null,
      createdAt: iso(addDays(now, -3)),
    },
    // For emp5 — missed checkout
    {
      id: genId("notif"), userId: mcEmployee.uid, type: "missed_checkout",
      title: "Missed Checkout Detected", message: "You forgot to clock out yesterday. Please contact admin.",
      read: false, linkTo: "/employee/attendance", relatedId: missedCheckouts[0]?.id || null,
      createdAt: iso(addDays(now, -1)),
    },
    // For all employees — payroll processed
    ...employees.map(emp => ({
      id: genId("notif"), userId: emp.uid, type: "payroll_processed",
      title: "Payroll Processed", message: `Your payroll for ${ml} has been processed. Check your payroll page for details.`,
      read: false, linkTo: "/employee/payroll", relatedId: allPayroll.find(p => p.employeeId === emp.uid)?.id || null,
      createdAt: iso(now),
    })),
    // For employees with invoices — invoice generated
    ...allInvoices.map(inv => ({
      id: genId("notif"), userId: inv.userId, type: "invoice_generated",
      title: "New Invoice Generated", message: `Invoice ${inv.invoiceNumber} has been generated for you.`,
      read: false, linkTo: "/employee/invoices", relatedId: inv.id,
      createdAt: iso(now),
    })),
    // Admin notification
    {
      id: genId("notif"), userId: admin.uid, type: "general",
      title: "Daily Missed Checkout Reminder", message: "There are 1 missed checkout(s) pending review.",
      read: false, linkTo: "/admin/missed-checkouts", relatedId: null,
      createdAt: iso(addDays(now, -1)),
    },
  ];

  for (const n of notifications) {
    await db.collection("notifications").doc(n.id).set(n);
  }
  console.log(`│  + ${notifications.length} notifications`);
  console.log("└─ Done\n");

  // ════════════════════════════════════════════════════════════
  // 9. CRON RUNS
  // ════════════════════════════════════════════════════════════
  console.log("┌─ 9. Creating cron run logs ────────────");

  const cronRuns = [
    {
      id: genId("cron"), jobName: "daily_missed_checkout",
      triggeredBy: "cron",
      startedAt: iso(addDays(now, -1)), completedAt: iso(addDays(now, -1)),
      status: "success",
      summary: "Detected 1 new, 2 total pending.",
      details: { newlyDetected: 1, totalPending: 2 },
      createdAt: iso(addDays(now, -1)),
    },
    {
      id: genId("cron"), jobName: "weekly_ceo_report",
      triggeredBy: "cron",
      startedAt: iso(addDays(now, -3)), completedAt: iso(addDays(now, -3)),
      status: "success",
      summary: "CEO weekly summary generated. 5 employees, 180.5 total hours.",
      details: { employeeCount: 5, totalHours: 180.5, totalPayroll: 6250.00 },
      createdAt: iso(addDays(now, -3)),
    },
    {
      id: genId("cron"), jobName: "invoice_maintenance",
      triggeredBy: admin.uid,
      startedAt: iso(addDays(now, -2)), completedAt: iso(addDays(now, -2)),
      status: "success",
      summary: "0 overdue invoices found.",
      details: { overdueCount: 0, checkedCount: allInvoices.length },
      createdAt: iso(addDays(now, -2)),
    },
  ];

  for (const cr of cronRuns) {
    await db.collection("cron_runs").doc(cr.id).set(cr);
  }
  console.log(`│  + ${cronRuns.length} cron logs`);
  console.log("└─ Done\n");

  // ════════════════════════════════════════════════════════════
  // 10. PAYROLL LOCKS (none active — just show structure)
  // ════════════════════════════════════════════════════════════
  // Not creating active locks so the seed data remains editable.
  // Admin can lock periods from the UI.

  // ════════════════════════════════════════════════════════════
  // SUMMARY
  // ════════════════════════════════════════════════════════════
  console.log("╔══════════════════════════════════════════╗");
  console.log("║          SEED COMPLETE!                  ║");
  console.log("╠══════════════════════════════════════════╣");
  console.log("║                                          ║");
  console.log("║  Collections populated:                  ║");
  console.log(`║    users .................. ${createdUsers.length.toString().padStart(3)}          ║`);
  console.log(`║    attendance_sessions .... ${allSessions.length.toString().padStart(3)}          ║`);
  console.log(`║    attendance_segments .... ${allSegments.length.toString().padStart(3)}          ║`);
  console.log(`║    timesheets ............. ${allTimesheets.length.toString().padStart(3)}          ║`);
  console.log(`║    payroll_runs ........... ${allPayroll.length.toString().padStart(3)}          ║`);
  console.log(`║    invoices ............... ${allInvoices.length.toString().padStart(3)}          ║`);
  console.log(`║    correction_requests .... ${corrections.length.toString().padStart(3)}          ║`);
  console.log(`║    audit_logs ............. ${auditLogs.length.toString().padStart(3)}          ║`);
  console.log(`║    missed_checkouts ....... ${missedCheckouts.length.toString().padStart(3)}          ║`);
  console.log(`║    notifications .......... ${notifications.length.toString().padStart(3)}          ║`);
  console.log(`║    cron_runs .............. ${cronRuns.length.toString().padStart(3)}          ║`);
  console.log("║    payroll_locks ..........   0          ║");
  console.log("║                                          ║");
  console.log("╠══════════════════════════════════════════╣");
  console.log("║  Login Credentials:                      ║");
  console.log("║                                          ║");
  console.log("║  Admin:                                  ║");
  console.log("║    admin@attendpay.com / Admin@123       ║");
  console.log("║                                          ║");
  console.log("║  CEO:                                    ║");
  console.log("║    ceo@attendpay.com / Ceo@12345         ║");
  console.log("║                                          ║");
  console.log("║  Employees:                              ║");
  console.log("║    emp1@attendpay.com / Employee@123     ║");
  console.log("║    emp2@attendpay.com / Employee@123     ║");
  console.log("║    emp3@attendpay.com / Employee@123     ║");
  console.log("║    emp4@attendpay.com / Employee@123     ║");
  console.log("║    emp5@attendpay.com / Employee@123     ║");
  console.log("║                                          ║");
  console.log("╚══════════════════════════════════════════╝");
}

seed().catch((err) => {
  console.error("\nSeed FAILED:", err);
  process.exit(1);
});
