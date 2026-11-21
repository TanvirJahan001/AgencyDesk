import "server-only";

import { unstable_cache } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import type {
  Announcement, AppUser, AttendanceSessionV2, Client, Department, Expense,
  Invoice, LeaveRequest, Project, Task, Timesheet,
} from "@/types";

type DemoCollections = {
  users: Pick<AppUser, "displayName" | "department" | "position" | "hourlyRate" | "overtimeMultiplier">;
  departments: Pick<Department, "name" | "description" | "headName">;
  attendance_sessions: Pick<AttendanceSessionV2, "userId" | "userName" | "workDate" | "clockInAt" | "clockOutAt" | "totalWorkMinutes" | "totalBreakMinutes" | "status">;
  timesheets: Pick<Timesheet, "employeeName" | "periodLabel" | "periodStart" | "totalWorkMs" | "totalDaysWorked" | "status">;
  invoices: Pick<Invoice, "invoiceNumber" | "projectName" | "periodLabel" | "total" | "status" | "createdAt">;
  clients: Pick<Client, "companyName" | "industry" | "billingType" | "status">;
  projects: Pick<Project, "name" | "clientName" | "serviceType" | "managerName" | "budget" | "spent" | "status" | "deadline">;
  tasks: Pick<Task, "title" | "projectName" | "assigneeName" | "dueDate" | "status">;
  leave_requests: Pick<LeaveRequest, "employeeName" | "type" | "startDate" | "endDate" | "totalDays" | "status">;
  expenses: Pick<Expense, "description" | "projectName" | "category" | "amount" | "date" | "status">;
  announcements: Pick<Announcement, "title" | "content" | "priority" | "createdAt" | "pinned">;
};

const FIELDS = {
  users: ["displayName", "department", "position", "hourlyRate", "overtimeMultiplier"],
  departments: ["name", "description", "headName"],
  attendance_sessions: ["userId", "userName", "workDate", "clockInAt", "clockOutAt", "totalWorkMinutes", "totalBreakMinutes", "status"],
  timesheets: ["employeeName", "periodLabel", "periodStart", "totalWorkMs", "totalDaysWorked", "status"],
  invoices: ["invoiceNumber", "projectName", "periodLabel", "total", "status", "createdAt"],
  clients: ["companyName", "industry", "billingType", "status"],
  projects: ["name", "clientName", "serviceType", "managerName", "budget", "spent", "status", "deadline"],
  tasks: ["title", "projectName", "assigneeName", "dueDate", "status"],
  leave_requests: ["employeeName", "type", "startDate", "endDate", "totalDays", "status"],
  expenses: ["description", "projectName", "category", "amount", "date", "status"],
  announcements: ["title", "content", "priority", "createdAt", "pinned"],
} satisfies { [K in keyof DemoCollections]: (keyof DemoCollections[K])[] };

const DEMO_DATASET = "agencydesk-demo-v1";

export type DemoRow<K extends keyof DemoCollections> = DemoCollections[K] & { id: string };

export const readDemoRows = unstable_cache(async function read<K extends keyof DemoCollections>(
  collection: K,
): Promise<DemoRow<K>[]> {
  // Require both the dataset marker and the reserved demo document prefix.
  const snapshot = await adminDb.collection(collection)
    .where("demoDataset", "==", DEMO_DATASET)
    .select(...FIELDS[collection])
    .limit(200)
    .get();

  return snapshot.docs
    .filter((doc) => doc.id.startsWith("demo-"))
    .map((doc) => ({ ...(doc.data() as DemoCollections[K]), id: doc.id }));
}, [DEMO_DATASET], { revalidate: 60 });
