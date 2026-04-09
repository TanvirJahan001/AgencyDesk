/**
 * scripts/seed-firestore.ts — Seed Firestore with test data
 *
 * Run with:
 *   npx tsx scripts/seed-firestore.ts
 *
 * Prerequisites:
 *   1. npm install (to get firebase-admin)
 *   2. .env.local must have valid Firebase Admin credentials
 *
 * What it does:
 *   1. Creates 2 test users in Firebase Auth (admin + employee)
 *   2. Creates matching Firestore /users documents with roles
 *   3. Creates sample attendance records for the employee
 *   4. Creates a sample payroll record for the employee
 *
 * IMPORTANT: This script is for LOCAL DEVELOPMENT only.
 *            Do NOT run this against a production database.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// ── Init Admin SDK ────────────────────────────────────────────

const serviceAccount = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON
  ? JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON)
  : {
      projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    };

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const auth = getAuth();
const db   = getFirestore();

// ── Test data ─────────────────────────────────────────────────

const TEST_USERS = [
  {
    email:       "admin@company.com",
    password:    "Admin123!",
    displayName: "Admin User",
    role:        "admin" as const,
    department:  "Management",
    position:    "System Administrator",
  },
  {
    email:       "employee@company.com",
    password:    "Employee123!",
    displayName: "John Smith",
    role:        "employee" as const,
    department:  "Engineering",
    position:    "Software Engineer",
  },
];

// ── Seed function ─────────────────────────────────────────────

async function seed() {
  console.log("Starting Firestore seed...\n");

  const createdUsers: { uid: string; email: string; role: string }[] = [];

  // 1. Create Auth users and Firestore profiles
  for (const user of TEST_USERS) {
    let uid: string;

    try {
      // Check if user already exists
      const existing = await auth.getUserByEmail(user.email);
      uid = existing.uid;
      console.log(`  Auth user exists: ${user.email} (${uid})`);
    } catch {
      // Create new Auth user
      const created = await auth.createUser({
        email:       user.email,
        password:    user.password,
        displayName: user.displayName,
      });
      uid = created.uid;
      console.log(`  Created Auth user: ${user.email} (${uid})`);
    }

    // Write Firestore /users/{uid} document
    await db.collection("users").doc(uid).set(
      {
        uid,
        email:       user.email,
        displayName: user.displayName,
        role:        user.role,
        department:  user.department,
        position:    user.position,
        createdAt:   new Date().toISOString(),
      },
      { merge: true }
    );
    console.log(`  Wrote Firestore profile for ${user.email} (role: ${user.role})`);

    createdUsers.push({ uid, email: user.email, role: user.role });
  }

  // 2. Create sample attendance records for the employee
  const employee = createdUsers.find((u) => u.role === "employee");
  if (employee) {
    console.log(`\n  Creating sample attendance for ${employee.email}...`);

    const today = new Date();
    for (let i = 0; i < 5; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD
      const docId = `${employee.uid}_${dateStr}`;

      const clockIn  = new Date(date);
      clockIn.setHours(9, Math.floor(Math.random() * 15), 0);

      const clockOut = new Date(date);
      clockOut.setHours(17, Math.floor(Math.random() * 45), 0);

      const hoursWorked = parseFloat(
        ((clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)).toFixed(2)
      );

      const statuses = ["present", "present", "present", "late", "present"] as const;

      await db.collection("attendance").doc(docId).set({
        id:          docId,
        employeeId:  employee.uid,
        date:        dateStr,
        clockIn:     clockIn.toISOString(),
        clockOut:    clockOut.toISOString(),
        status:      statuses[i],
        hoursWorked,
        notes:       null,
      });
      console.log(`    ${dateStr} — ${statuses[i]} (${hoursWorked}h)`);
    }

    // 3. Create a sample payroll record
    console.log(`\n  Creating sample payroll for ${employee.email}...`);

    const period = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const payrollDocId = `${employee.uid}_${period}`;

    await db.collection("payroll").doc(payrollDocId).set({
      id:          payrollDocId,
      employeeId:  employee.uid,
      period,
      baseSalary:  4000,
      overtime:    350,
      deductions:  500,
      netPay:      3850,
      status:      "paid",
      processedAt: new Date().toISOString(),
      paidAt:      new Date().toISOString(),
    });
    console.log(`    ${period} — $3,850.00 (paid)`);
  }

  console.log("\nSeed complete!");
  console.log("\nTest credentials:");
  console.log("  Admin:    admin@company.com    / Admin123!");
  console.log("  Employee: employee@company.com / Employee123!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
