/**
 * types/index.ts
 *
 * Shared TypeScript types used across the entire application.
 * Keep domain models here so they can be imported by both
 * client components and server-side code without circular deps.
 */

// ─── Auth & Users ────────────────────────────────────────────

export type UserRole = "admin" | "employee" | "ceo";
export type PayType  = "hourly" | "weekly" | "bi-weekly" | "monthly" | "project-based";

export const DEPARTMENTS = ["IT", "HR", "Finance", "Marketing", "Operations", "Sales"] as const;

export interface Department {
  id: string;
  name: string;
  headId?: string;       // department head (employee uid)
  headName?: string;
  description?: string;
  employeeCount?: number; // computed on read
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export const POSITIONS   = ["Manager", "Developer", "Designer", "Accountant", "Analyst", "HR Specialist", "Sales Rep"] as const;
export const PAY_TYPES: { value: PayType; label: string }[] = [
  { value: "hourly",        label: "Hourly" },
  { value: "weekly",        label: "Weekly" },
  { value: "bi-weekly",     label: "Bi-weekly" },
  { value: "monthly",       label: "Monthly" },
  { value: "project-based", label: "Project-based" },
];

export interface AppUser {
  uid:               string;
  email:             string;
  displayName:       string;
  role:              UserRole;
  department?:       string;
  position?:         string;
  createdAt:         string; // ISO 8601
  photoURL?:         string;
  payType?:          PayType;       // how the employee is paid
  salaryAmount?:     number;        // amount per pay period (or per hour if payType is "hourly")
  hourlyRate?:       number;        // kept for payroll calculator compatibility
  overtimeMultiplier?: number;      // e.g. 1.5 (default if unset)
  weeklyOvertimeThresholdMin?: number; // minutes per week before OT kicks in (default 2400 = 40h)
  phone?: string;
  dateOfBirth?: string;          // YYYY-MM-DD
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  emergencyContacts?: EmergencyContact[];
  bankDetails?: BankDetails;
  joinDate?: string;             // YYYY-MM-DD
  bio?: string;
}

// ─── Attendance ───────────────────────────────────────────────

export type AttendanceStatus = "present" | "absent" | "late" | "half-day" | "holiday";

export interface AttendanceRecord {
  id:         string;
  employeeId: string;
  date:       string;       // YYYY-MM-DD
  clockIn?:   string;       // ISO 8601 timestamp
  clockOut?:  string;       // ISO 8601 timestamp
  status:     AttendanceStatus;
  hoursWorked?: number;
  notes?:     string;
}

// ─── Payroll ──────────────────────────────────────────────────

export type PayrollStatus = "draft" | "processed" | "paid";

/**
 * payroll_runs/{runId}
 *
 * One record per employee per period. Contains the full
 * calculated breakdown of regular vs overtime work and pay.
 */
export interface PayrollRun {
  id:                   string;
  employeeId:           string;
  employeeName:         string;
  period:               string;       // "2026-W15" or "2026-04"
  periodType:           TimesheetPeriodType;
  periodStart:          string;       // YYYY-MM-DD
  periodEnd:            string;       // YYYY-MM-DD
  timesheetId:          string | null; // linked approved timesheet

  // ── Rate config (snapshot at calculation time) ──
  hourlyRate:           number;       // $/hr
  overtimeMultiplier:   number;       // e.g. 1.5
  weeklyOtThresholdMin: number;       // minutes before OT (default 2400 = 40h)

  // ── Calculated time ──
  totalWorkMin:         number;       // total minutes worked in period
  regularMin:           number;       // minutes at regular rate
  overtimeMin:          number;       // minutes at overtime rate

  // ── Calculated pay ──
  regularPay:           number;       // regularMin/60 * hourlyRate
  overtimePay:          number;       // overtimeMin/60 * hourlyRate * overtimeMultiplier
  grossPay:             number;       // regularPay + overtimePay
  deductions:           number;       // manual deductions (admin-set)
  netPay:               number;       // grossPay - deductions

  // ── Day-by-day breakdown ──
  dailyBreakdown:       PayrollDayBreakdown[];

  status:               PayrollStatus;
  calculatedAt:         string;       // ISO 8601
  processedAt:          string | null;
  paidAt:               string | null;
  createdBy:            string;       // admin UID who generated
  createdByName:        string;
  createdAt:            string;
  updatedAt:            string;
}

/**
 * Per-day work summary embedded in PayrollRun.
 */
export interface PayrollDayBreakdown {
  date:        string;  // YYYY-MM-DD
  workMin:     number;  // minutes worked that day
  sessionIds:  string[];
}

/** Legacy alias — keep for backward compat with PayrollRecord references */
export type PayrollRecord = PayrollRun;

// ─── Payslips ─────────────────────────────────────────────────

export interface Payslip {
  id:              string;
  payrollRunId:    string;
  employeeId:      string;
  employeeName:    string;
  period:          string;
  periodStart:     string;
  periodEnd:       string;
  department?:     string;
  position?:       string;
  // Earnings
  regularHours:    number;
  overtimeHours:   number;
  regularPay:      number;
  overtimePay:     number;
  grossPay:        number;
  // Deductions breakdown
  deductions:      { name: string; amount: number }[];
  totalDeductions: number;
  netPay:          number;
  // Meta
  generatedAt:     string;
  generatedBy:     string;
  status:          "generated" | "issued" | "viewed";
  createdAt:       string;
  updatedAt:       string;
}

// ─── Navigation ───────────────────────────────────────────────

export interface NavItem {
  label:    string;
  href:     string;
  icon:     React.ElementType;
  roles:    UserRole[];        // which roles can see this item
  children?: NavItem[];
}

// ─── Attendance Engine ────────────────────────────────────────

/**
 * Session status state machine:
 *   active → paused → active → completed
 *                              ↗
 *   active ────────────────────
 */
export type SessionStatus = "active" | "paused" | "completed" | "missed_checkout";

export type SegmentType = "work" | "break";

/**
 * attendance_sessions/{sessionId}
 *
 * One document per employee per workday.
 * Only ONE session can be "active" or "paused" per employee at a time.
 */
export interface AttendanceSession {
  id:               string;
  employeeId:       string;
  employeeName:     string;
  date:             string;         // YYYY-MM-DD
  status:           SessionStatus;
  startTime:        string;         // ISO 8601
  endTime:          string | null;
  totalWorkMs:      number;
  totalBreakMs:     number;
  segmentCount:     number;
  currentSegmentId: string | null;
  createdAt:        string;
  updatedAt:        string;
}

/**
 * attendance_segments/{segmentId}
 *
 * Continuous block of "work" or "break" time inside a session.
 */
export interface AttendanceSegment {
  id:         string;
  sessionId:  string;
  employeeId: string;
  type:       SegmentType;
  startTime:  string;         // ISO 8601
  endTime:    string | null;  // null while open
  durationMs: number;         // 0 while open, computed on close
  createdAt:  string;
}

/**
 * Client-side live timer state, recalculated every second.
 */
export interface LiveTimerState {
  status:                     SessionStatus | "idle";
  sessionId:                  string | null;
  totalWorkMs:                number;
  totalBreakMs:               number;
  currentSegmentType:         SegmentType | null;
  currentSegmentStartTime:    string | null;
  elapsedSinceSegmentStartMs: number;
}

// ─── Correction Requests ──────────────────────────────────────

export type CorrectionStatus = "pending" | "approved" | "rejected";

export type CorrectionField = "clockIn" | "clockOut" | "status" | "date";

/**
 * A single field change requested by the employee.
 * e.g. { field: "clockIn", oldValue: "09:15", newValue: "08:55" }
 */
export interface CorrectionChange {
  field:    CorrectionField;
  oldValue: string;
  newValue: string;
}

/**
 * correction_requests/{requestId}
 *
 * Employee submits a correction for a specific attendance session.
 * Admin reviews and approves or rejects.
 * On approval the session is updated and an audit log is written.
 */
export interface CorrectionRequest {
  id:             string;
  sessionId:      string;            // references attendance_sessions/{id}
  employeeId:     string;
  employeeName:   string;
  sessionDate:    string;            // YYYY-MM-DD (for easy querying)
  reason:         string;            // why the employee needs the correction
  changes:        CorrectionChange[];
  status:         CorrectionStatus;
  reviewedBy:     string | null;     // admin UID who reviewed
  reviewerName:   string | null;
  reviewNote:     string | null;     // optional admin note on approve/reject
  reviewedAt:     string | null;     // ISO 8601
  createdAt:      string;
  updatedAt:      string;
}

/**
 * audit_logs/{logId}
 *
 * Immutable trail of every action that mutated system state.
 * Supports corrections, sessions, employees, leaves, expenses, payroll, contracts, settings, etc.
 */
export interface AuditLog {
  id:            string;
  type:          "correction_approved" | "correction_rejected" | "session_modified"
                 | "employee_created" | "employee_updated" | "employee_deleted"
                 | "leave_approved" | "leave_rejected"
                 | "expense_approved" | "expense_rejected"
                 | "payroll_processed" | "payroll_paid"
                 | "contract_created" | "contract_updated"
                 | "settings_updated" | "bulk_operation";
  correctionId?: string;
  sessionId?:    string;
  employeeId?:   string;
  adminId:       string;
  adminName:     string;
  changes?:      CorrectionChange[];
  note?:         string | null;
  metadata?:     Record<string, unknown>;  // additional context
  timestamp:     string;            // ISO 8601
}

// ─── Timesheets ───────────────────────────────────────────────

export type TimesheetStatus = "draft" | "submitted" | "approved" | "rejected";

export type TimesheetPeriodType = "weekly" | "monthly";

/**
 * A single day's summary within a timesheet.
 * Aggregated from attendance_sessions.
 */
export interface TimesheetDayEntry {
  date:         string;   // YYYY-MM-DD
  sessionIds:   string[]; // attendance_sessions referenced
  totalWorkMs:  number;
  totalBreakMs: number;
  status:       SessionStatus | "absent"; // completed / active / paused / absent
}

/**
 * timesheets/{timesheetId}
 *
 * Aggregates a week or month of attendance into a single
 * reviewable, approvable document.
 */
export interface Timesheet {
  id:             string;
  employeeId:     string;
  employeeName:   string;
  periodType:     TimesheetPeriodType;
  periodLabel:    string;          // e.g. "2026-W15" or "2026-04"
  periodStart:    string;          // YYYY-MM-DD (Mon for weekly, 1st for monthly)
  periodEnd:      string;          // YYYY-MM-DD (Sun for weekly, last day for monthly)
  days:           TimesheetDayEntry[];
  totalWorkMs:    number;
  totalBreakMs:   number;
  totalDaysWorked: number;
  status:         TimesheetStatus;
  submittedAt:    string | null;
  reviewedBy:     string | null;   // admin UID
  reviewerName:   string | null;
  reviewNote:     string | null;
  reviewedAt:     string | null;
  locked:         boolean;         // true after payroll lock
  lockedAt:       string | null;
  lockedBy:       string | null;
  createdAt:      string;
  updatedAt:      string;
}

/**
 * payroll_locks/{lockId}
 *
 * Once an admin locks a payroll period, no further edits
 * to timesheets or sessions within that range are allowed.
 */
export interface PayrollLock {
  id:          string;
  periodType:  TimesheetPeriodType;
  periodLabel: string;          // "2026-W15" or "2026-04"
  periodStart: string;
  periodEnd:   string;
  lockedBy:    string;          // admin UID
  lockedByName: string;
  lockedAt:    string;          // ISO 8601
}

// ─── Notifications ────────────────────────────────────────────

export type NotificationType =
  | "missed_checkout"
  | "correction_approved"
  | "correction_rejected"
  | "timesheet_approved"
  | "timesheet_rejected"
  | "payroll_processed"
  | "invoice_generated"
  | "leave_requested"
  | "leave_approved"
  | "leave_rejected"
  | "expense_submitted"
  | "expense_approved"
  | "expense_rejected"
  | "project_created"
  | "project_assigned"
  | "task_assigned"
  | "task_completed"
  | "client_added"
  | "announcement"
  | "general";

/**
 * notifications/{notificationId}
 *
 * In-app notifications for employees and admins.
 * Read-only from client; written by server (Admin SDK).
 */
export interface AppNotification {
  id:          string;
  userId:      string;         // recipient UID
  type:        NotificationType;
  title:       string;
  message:     string;
  read:        boolean;
  linkTo:      string | null;  // e.g. "/employee/attendance"
  relatedId:   string | null;  // e.g. session ID, correction ID
  createdAt:   string;         // ISO 8601
}

/**
 * missed_checkouts/{id}
 *
 * Tracks sessions flagged as missed checkout.
 * Admin reviews and either adjusts the end time or marks as resolved.
 */
export type MissedCheckoutResolution = "pending" | "auto_closed" | "admin_adjusted" | "employee_corrected";

export interface MissedCheckout {
  id:               string;
  sessionId:        string;
  employeeId:       string;
  employeeName:     string;
  sessionDate:      string;           // YYYY-MM-DD
  startTime:        string;           // ISO 8601
  detectedAt:       string;           // ISO 8601
  resolution:       MissedCheckoutResolution;
  resolvedBy:       string | null;    // admin UID or "system"
  resolvedByName:   string | null;
  resolvedAt:       string | null;
  adjustedEndTime:  string | null;    // admin-set end time
  note:             string | null;
  createdAt:        string;
  updatedAt:        string;
}

// ─── Attendance V2 (clean schema) ────────────────────────────

export type SessionStatusV2 = "working" | "on_break" | "completed" | "missed_checkout";
export type ApprovedStatus  = "pending" | "approved" | "rejected";

export interface AttendanceSessionV2 {
  id:                 string;
  userId:             string;
  userName:           string;
  workDate:           string;       // YYYY-MM-DD
  status:             SessionStatusV2;
  clockInAt:          string;       // ISO 8601
  clockOutAt:         string | null;
  totalWorkMinutes:   number;
  totalBreakMinutes:  number;
  overtimeMinutes:    number;
  approvedStatus:     ApprovedStatus;
  createdAt:          string;
  updatedAt:          string;
}

export interface AttendanceSegmentV2 {
  id:              string;
  sessionId:       string;
  userId:          string;
  type:            "work" | "break";
  startAt:         string;       // ISO 8601
  endAt:           string | null;
  durationMinutes: number;
  createdAt:       string;
}

/**
 * cron_runs/{runId}
 *
 * Log of each cron/job execution for auditing.
 * Keeps track of what ran, when, and results.
 */
export interface CronRunLog {
  id:          string;
  jobName:     string;           // "daily_missed_checkout" | "weekly_ceo_report"
  triggeredBy: string;           // "cron" | "manual" | admin UID
  startedAt:   string;
  completedAt: string | null;
  status:      "success" | "error";
  summary:     string;           // human-readable result
  details:     Record<string, unknown>;
  createdAt:   string;
}

// ─── Invoices ─────────────────────────────────────────────────

export type InvoiceBillingType = "hourly" | "weekly" | "bi-weekly" | "monthly" | "project-based";
export type InvoiceStatus = "draft" | "issued" | "paid" | "cancelled";

export interface InvoiceLineItem {
  description: string;
  quantity:    number;
  unitRate:    number;
  amount:      number;
}

/**
 * invoices/{invoiceId}
 */
export interface Invoice {
  id:            string;
  invoiceNumber: string;          // human-friendly e.g. "INV-2026-0042"
  userId:        string;
  employeeName:  string;
  billingType:   InvoiceBillingType;
  periodLabel:   string;          // "2026-W15", "2026-04", custom
  periodStart:   string;          // YYYY-MM-DD
  periodEnd:     string;          // YYYY-MM-DD
  projectId:     string | null;
  projectName:   string | null;
  lineItems:     InvoiceLineItem[];
  subtotal:      number;
  tax:           number;
  discount:      number;
  total:         number;
  currency:      string;          // default "USD"
  status:        InvoiceStatus;
  notes:         string | null;
  generatedBy:   string;          // admin UID
  createdAt:     string;
  updatedAt:     string;
  paidAt:        string | null;
}

// ─── Clients ──────────────────────────────────────────────────

export type ClientStatus = "lead" | "active" | "paused" | "churned";

export const CLIENT_STATUSES: { value: ClientStatus; label: string }[] = [
  { value: "lead",    label: "Lead" },
  { value: "active",  label: "Active" },
  { value: "paused",  label: "Paused" },
  { value: "churned", label: "Churned" },
];

export const SERVICE_TYPES = [
  "SEO", "PPC", "Social Media", "Content Marketing",
  "Branding", "Web Design", "Email Marketing", "Video Production",
  "PR", "Consulting", "Other",
] as const;

export interface Client {
  id:             string;
  companyName:    string;
  contactName:    string;
  contactEmail:   string;
  contactPhone:   string;
  address?:       string;
  website?:       string;
  industry?:      string;
  status:         ClientStatus;
  billingType:    "retainer" | "project-based" | "hourly";
  monthlyRetainer?: number;     // if billing is retainer
  currency:       string;       // default "USD"
  notes?:         string;
  createdBy:      string;       // admin UID
  createdAt:      string;
  updatedAt:      string;
}

// ─── Projects ─────────────────────────────────────────────────

export type ProjectStatus = "lead" | "proposal" | "active" | "on_hold" | "completed" | "archived";

export const PROJECT_STATUSES: { value: ProjectStatus; label: string; color: string }[] = [
  { value: "lead",      label: "Lead",      color: "bg-gray-100 text-gray-700" },
  { value: "proposal",  label: "Proposal",  color: "bg-blue-100 text-blue-700" },
  { value: "active",    label: "Active",    color: "bg-green-100 text-green-700" },
  { value: "on_hold",   label: "On Hold",   color: "bg-yellow-100 text-yellow-700" },
  { value: "completed", label: "Completed", color: "bg-purple-100 text-purple-700" },
  { value: "archived",  label: "Archived",  color: "bg-red-100 text-red-700" },
];

export interface Project {
  id:             string;
  name:           string;
  clientId:       string;
  clientName:     string;
  serviceType:    string;         // from SERVICE_TYPES
  status:         ProjectStatus;
  description?:   string;
  budget:         number;         // total project budget
  spent:          number;         // running total from tracked hours / expenses
  currency:       string;
  startDate:      string;         // YYYY-MM-DD
  deadline:       string;         // YYYY-MM-DD
  completedDate?: string;
  teamMembers:    string[];       // array of employee UIDs
  managerId:      string;         // lead employee UID
  managerName:    string;
  tags?:          string[];
  createdBy:      string;
  createdAt:      string;
  updatedAt:      string;
}

// ─── Tasks ────────────────────────────────────────────────────

export type TaskStatus   = "todo" | "in_progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export const TASK_STATUSES: { value: TaskStatus; label: string; color: string }[] = [
  { value: "todo",        label: "To Do",       color: "bg-gray-100 text-gray-700" },
  { value: "in_progress", label: "In Progress", color: "bg-blue-100 text-blue-700" },
  { value: "review",      label: "Review",      color: "bg-yellow-100 text-yellow-700" },
  { value: "done",        label: "Done",        color: "bg-green-100 text-green-700" },
];

export const TASK_PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: "low",    label: "Low",    color: "bg-gray-100 text-gray-600" },
  { value: "medium", label: "Medium", color: "bg-blue-100 text-blue-600" },
  { value: "high",   label: "High",   color: "bg-orange-100 text-orange-600" },
  { value: "urgent", label: "Urgent", color: "bg-red-100 text-red-600" },
];

export interface Task {
  id:            string;
  projectId:     string;
  projectName:   string;
  clientId:      string;
  title:         string;
  description?:  string;
  status:        TaskStatus;
  priority:      TaskPriority;
  assigneeId:    string | null;
  assigneeName:  string | null;
  dueDate:       string | null;    // YYYY-MM-DD
  estimatedMin:  number;           // estimated time in minutes
  loggedMin:     number;           // actual time logged
  order:         number;           // sort order within status column
  tags?:         string[];
  completedAt?:  string;
  createdBy:     string;
  createdAt:     string;
  updatedAt:     string;
}

export interface TaskComment {
  id:         string;
  taskId:     string;
  authorId:   string;
  authorName: string;
  content:    string;
  createdAt:  string;
}

export interface TimeLog {
  id:           string;
  taskId:       string;
  projectId:    string;
  employeeId:   string;
  employeeName: string;
  description?: string;
  minutes:      number;
  date:         string;          // YYYY-MM-DD
  createdAt:    string;
}

// ─── Leave Management ─────────────────────────────────────────

export type LeaveType   = "annual" | "sick" | "personal" | "unpaid" | "maternity" | "paternity" | "other";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: "annual",    label: "Annual Leave" },
  { value: "sick",      label: "Sick Leave" },
  { value: "personal",  label: "Personal Day" },
  { value: "unpaid",    label: "Unpaid Leave" },
  { value: "maternity", label: "Maternity Leave" },
  { value: "paternity", label: "Paternity Leave" },
  { value: "other",     label: "Other" },
];

export interface LeaveRequest {
  id:            string;
  employeeId:    string;
  employeeName:  string;
  type:          LeaveType;
  startDate:     string;         // YYYY-MM-DD
  endDate:       string;         // YYYY-MM-DD
  totalDays:     number;
  reason:        string;
  status:        LeaveStatus;
  reviewedBy:    string | null;
  reviewerName:  string | null;
  reviewNote:    string | null;
  reviewedAt:    string | null;
  createdAt:     string;
  updatedAt:     string;
}

export interface LeaveBalance {
  id:            string;
  employeeId:    string;
  year:          number;         // e.g. 2026
  annual:        { total: number; used: number; remaining: number };
  sick:          { total: number; used: number; remaining: number };
  personal:      { total: number; used: number; remaining: number };
  updatedAt:     string;
}

export interface Holiday {
  id:       string;
  name:     string;
  date:     string;             // YYYY-MM-DD
  year:     number;
  type:     "public" | "company";
  createdBy: string;
  createdAt: string;
}

// ─── Expenses & Financial ─────────────────────────────────────

export type ExpenseCategory =
  | "advertising"   | "software"      | "office"
  | "travel"        | "meals"         | "equipment"
  | "freelancer"    | "subscription"  | "utilities"
  | "other";

export type ExpenseStatus = "pending" | "approved" | "rejected";

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "advertising",  label: "Advertising / Ad Spend" },
  { value: "software",     label: "Software & Tools" },
  { value: "office",       label: "Office Supplies" },
  { value: "travel",       label: "Travel" },
  { value: "meals",        label: "Meals & Entertainment" },
  { value: "equipment",    label: "Equipment" },
  { value: "freelancer",   label: "Freelancer / Contractor" },
  { value: "subscription", label: "Subscriptions" },
  { value: "utilities",    label: "Utilities" },
  { value: "other",        label: "Other" },
];

export interface Expense {
  id:           string;
  projectId:    string | null;     // optional — can be general expense
  projectName:  string | null;
  clientId:     string | null;
  category:     ExpenseCategory;
  description:  string;
  amount:       number;
  currency:     string;
  date:         string;            // YYYY-MM-DD
  receiptUrl?:  string;            // Firebase Storage URL
  status:       ExpenseStatus;
  submittedBy:  string;
  submitterName: string;
  approvedBy?:  string;
  approvedAt?:  string;
  createdAt:    string;
  updatedAt:    string;
}

// ─── Settings ─────────────────────────────────────────────────

export interface OvertimePolicy {
  id:                      string;
  name:                    string;                    // e.g. "Standard", "Senior", "Weekend"
  weeklyThresholdMinutes:  number;                    // e.g. 2400 (40 hours)
  dailyThresholdMinutes?:  number;                    // e.g. 480 (8 hours)
  regularMultiplier:       number;                    // 1.0
  overtimeMultiplier:      number;                    // 1.5
  weekendMultiplier?:      number;                    // 2.0
  holidayMultiplier?:      number;                    // 2.5
  isDefault:               boolean;                   // one policy must be default
  createdAt:               string;
  updatedAt:               string;
}

export interface TaxBracket {
  id:         string;
  name:       string;                                 // e.g. "Standard Employee Tax"
  brackets:   {
    min:      number;
    max:      number | null;                          // null = unlimited
    rate:     number;                                 // 0.10 = 10%
  }[];
  createdAt:  string;
  updatedAt:  string;
}

export interface DeductionTemplate {
  id:          string;
  name:        string;                                // e.g. "Health Insurance", "Provident Fund"
  type:        "fixed" | "percentage";
  amount:      number;                                // fixed amount in currency or percentage (0.05 = 5%)
  isDefault:   boolean;                               // auto-apply to new employees
  description?: string;
  createdAt:   string;
  updatedAt:   string;
}

// ─── Announcements ────────────────────────────────────────────

export interface Announcement {
  id:         string;
  title:      string;
  content:    string;
  priority:   "normal" | "important" | "urgent";
  authorId:   string;
  authorName: string;
  pinned:     boolean;
  expiresAt?: string;              // ISO 8601 — auto-hide after this date
  createdAt:  string;
  updatedAt:  string;
}

// ─── Onboarding & Offboarding ──────────────────────────────────

export type OnboardingStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type OffboardingStatus = "pending" | "in_progress" | "completed";

export interface ChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
  notes?: string;
}

export interface OnboardingRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  department?: string;
  position?: string;
  startDate: string;
  status: OnboardingStatus;
  checklist: ChecklistItem[];
  assignedTo?: string;        // admin uid handling this onboarding
  assignedToName?: string;
  notes?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OffboardingRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  department?: string;
  position?: string;
  lastDay: string;
  reason: "resignation" | "termination" | "retirement" | "contract_end" | "other";
  status: OffboardingStatus;
  checklist: ChecklistItem[];
  assignedTo?: string;
  assignedToName?: string;
  notes?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_ONBOARDING_CHECKLIST: Omit<ChecklistItem, "id">[] = [
  { title: "Create email account", completed: false },
  { title: "Set up workstation / laptop", completed: false },
  { title: "Provide access credentials", completed: false },
  { title: "Add to team communication channels", completed: false },
  { title: "Collect signed employment contract", completed: false },
  { title: "Collect ID documents & tax forms", completed: false },
  { title: "Schedule orientation meeting", completed: false },
  { title: "Assign mentor / buddy", completed: false },
  { title: "Complete first-day walkthrough", completed: false },
  { title: "Verify payroll setup", completed: false },
];

export const DEFAULT_OFFBOARDING_CHECKLIST: Omit<ChecklistItem, "id">[] = [
  { title: "Revoke system access & credentials", completed: false },
  { title: "Collect company equipment", completed: false },
  { title: "Transfer project responsibilities", completed: false },
  { title: "Conduct exit interview", completed: false },
  { title: "Process final payroll", completed: false },
  { title: "Remove from communication channels", completed: false },
  { title: "Archive employee documents", completed: false },
  { title: "Update team assignments", completed: false },
  { title: "Send farewell communication", completed: false },
];

// ─── Documents ────────────────────────────────────────────────

export type DocumentCategory = "contract" | "id_document" | "certificate" | "tax_form" | "offer_letter" | "policy" | "other";
export type DocumentStatus = "active" | "expired" | "archived";

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  employeeName: string;
  title: string;
  category: DocumentCategory;
  description?: string;
  fileUrl: string;         // external URL to the document
  fileName: string;
  fileType?: string;       // e.g. "application/pdf"
  expiresAt?: string;      // ISO 8601 — for certifications with expiry
  uploadedBy: string;      // uid
  uploadedByName: string;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
}

export const DOCUMENT_CATEGORIES = [
  { value: "contract" as const,      label: "Employment Contract" },
  { value: "id_document" as const,   label: "ID Document" },
  { value: "certificate" as const,   label: "Certificate / License" },
  { value: "tax_form" as const,      label: "Tax Form" },
  { value: "offer_letter" as const,  label: "Offer Letter" },
  { value: "policy" as const,        label: "Policy Document" },
  { value: "other" as const,         label: "Other" },
] as const;

// ─── Company Settings & Branding ──────────────────────────────

export interface CompanySettings {
  id:                  "company_settings";   // singleton document
  companyName:         string;
  companyEmail?:       string;
  companyPhone?:       string;
  companyWebsite?:     string;
  address?:            {
    street?:           string;
    city?:             string;
    state?:            string;
    zipCode?:          string;
    country?:          string;
  };
  logoUrl?:            string;               // URL to company logo
  businessHours?:      {
    start:             string;               // "09:00"
    end:               string;               // "17:00"
    workDays:          number[];             // [1,2,3,4,5] = Mon-Fri
  };
  fiscalYearStart?:    string;               // "01" to "12" (month)
  currency:            string;               // "USD", "BDT", etc.
  currencySymbol:      string;               // "$", "৳", etc.
  timezone:            string;               // "Asia/Dhaka", "America/New_York", etc.
  updatedAt:           string;
  updatedBy:           string;
}

// ─── Shifts & Work Schedules ─────────────────────────────────

export type ShiftType = "morning" | "afternoon" | "night" | "split" | "flexible" | "custom";
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sun, 6=Sat

export interface ShiftTemplate {
  id: string;
  name: string;                    // e.g. "Morning Shift", "Night Shift"
  type: ShiftType;
  startTime: string;               // "09:00"
  endTime: string;                 // "17:00"
  breakMinutes: number;            // e.g. 60
  workDays: DayOfWeek[];           // e.g. [1,2,3,4,5]
  color: string;                   // hex color for calendar display
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeSchedule {
  id: string;
  employeeId: string;
  employeeName: string;
  shiftTemplateId: string;
  shiftTemplateName: string;
  startDate: string;               // YYYY-MM-DD — when this schedule begins
  endDate?: string;                // YYYY-MM-DD — null = ongoing
  overrides?: ScheduleOverride[];  // per-day overrides
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleOverride {
  date: string;                    // YYYY-MM-DD
  startTime?: string;
  endTime?: string;
  dayOff?: boolean;
  reason?: string;
}

// ─── Contracts & Agreements ──────────────────────────────────

export type ContractType = "employment" | "nda" | "freelancer" | "client" | "vendor" | "other";
export type ContractStatus = "draft" | "pending_signature" | "active" | "expired" | "terminated";

export const CONTRACT_TYPES: { value: ContractType; label: string }[] = [
  { value: "employment",  label: "Employment Contract" },
  { value: "nda",         label: "Non-Disclosure Agreement" },
  { value: "freelancer",  label: "Freelancer Agreement" },
  { value: "client",      label: "Client Contract" },
  { value: "vendor",      label: "Vendor Agreement" },
  { value: "other",       label: "Other" },
];

export interface Contract {
  id: string;
  title: string;
  type: ContractType;
  status: ContractStatus;
  partyName: string;              // employee name, client name, vendor name
  partyId?: string;               // employee uid or client id
  partyType: "employee" | "client" | "vendor" | "other";
  description?: string;
  fileUrl?: string;               // uploaded contract document URL
  fileName?: string;
  startDate: string;              // YYYY-MM-DD
  endDate?: string;               // YYYY-MM-DD — null = indefinite
  value?: number;                 // contract monetary value
  currency?: string;
  renewalDate?: string;           // YYYY-MM-DD — when to review for renewal
  terms?: string;                 // key terms summary (text)
  signedAt?: string;
  signedBy?: string;              // uid
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}


// ─── Employee Self-Service ───────────────────────────────────

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

export interface BankDetails {
  bankName: string;
  accountNumber: string;        // last 4 digits only stored
  routingNumber?: string;       // last 4 digits only stored
  accountType: "checking" | "savings";
}

// ─── API Responses ────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?:   T;
  error?:  string;
}
