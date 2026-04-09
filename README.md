# AgencyDesk — Agency Management System

A full-stack agency management system built with Next.js 16, Firebase, and Tailwind CSS. Features attendance tracking, payroll management, project & client management, invoicing, expense tracking, leave management, and role-based dashboards for employees, admins, and CEOs. Developed by Tanvir Jahan.

---

## Features

### Authentication & Role-Based Access

- Email/password authentication via Firebase Auth with secure httpOnly session cookies (5-day expiry)
- Three-tier role system: **Employee**, **Admin**, **CEO**
- Role verification at three layers: Edge middleware (fast cookie check), Server (Admin SDK verification), and Firestore Security Rules
- Change password functionality with current password verification
- Session token refresh and revocation support

### Employee Features

- **Dashboard** — Personal KPIs: days present this month, total work hours this week, estimated pay, and missed checkout warnings
- **Live Attendance Panel** — Big status label with pulsing indicator, large mono-font live timer that survives page refresh, contextual action buttons (Start Work / Pause / Resume / End Work) that only show valid actions for the current state
- **Work/Break Tracking** — Real-time tracking of work and break segments with automatic duration calculation
- **Today's Summary** — Breakdown of hours worked, break duration, overtime, and current session status
- **Attendance History** — Searchable history of past sessions with date range filtering
- **Weekly Summary Card** — Week navigator showing daily breakdown, total hours, and gross pay estimate
- **Monthly Summary Card** — Month navigator with per-day table, stat row (days worked, total hours, regular/OT pay), and zero-day filtering
- **Correction Requests** — Submit requests to fix clock-in/clock-out times, dates, or status with required reason (min 10 characters) and change details
- **Timesheets** — View and submit weekly/monthly timesheets with per-day session aggregation
- **Payroll View** — See personal payroll runs with regular hours, overtime hours, hourly rate, deductions, and net pay
- **Profile Page** — View personal information (name, email, department, position, hourly rate, overtime multiplier)

### Admin Features

- **Dashboard** — 6 KPI tiles: Total Employees, Currently Working, On Break, Missed Checkouts, Weekly Total Hours, Weekly Payroll Estimate
- **Employee Management** — Full CRUD: add employees (creates Firebase Auth + Firestore user), edit details, activate/deactivate accounts, permanently delete employees (removes from Auth + database)
- **Employee Search** — Filter employees by name, email, or department
- **Payroll Rate Configuration** — Set per-employee hourly rate, overtime multiplier, and weekly overtime threshold
- **Attendance Oversight** — View all employee attendance with filters by employee, date range, and status; 8-column table (Employee, Date, Clock In, Clock Out, Break, Work Hours, Overtime, Status) with totals footer
- **Correction Review** — Approve or reject employee correction requests with optional reviewer notes; approved corrections are automatically applied to the attendance session
- **Missed Checkout Management** — Track and resolve missed checkouts with resolution types: auto-closed, admin-adjusted, or employee-corrected
- **Payroll Generation** — Calculate payroll for individual employees or batch-generate for all employees; supports weekly and monthly periods
- **Payroll Processing** — Manage payroll run lifecycle: Draft → Processed → Paid with deduction support
- **Timesheet Approval** — Review submitted timesheets, approve or reject with notes; track reviewer identity and timestamp
- **Payroll Period Locking** — Lock periods to prevent retroactive edits to sessions, timesheets, and corrections
- **Reports** — Generate downloadable weekly attendance (XLSX) and monthly payroll (XLSX/PDF) reports with employee filtering
- **Cron Job Monitoring** — View execution logs of automated jobs with status, summary, and detailed results

### CEO Features

- **Executive Dashboard** — Workforce overview KPIs (employees, working, on break, missed checkouts) + productivity KPIs (today's hours, week hours, weekly payroll estimate)
- **Employee Directory** — View complete employee roster (read-only)
- **Payroll Reports** — Access all payroll runs and summaries; side-by-side "This Week" and "This Month" cards with per-employee breakdowns
- **Report Generation** — Same download capabilities as admin for attendance and payroll reports

### Attendance Engine

- **Session State Machine** — Enforced lifecycle: `idle → working → on_break → working → completed` with `missed_checkout` detection
- **Segment-Based Tracking** — Each work/break period stored as a separate segment with precise start/end timestamps and duration
- **Live Timer Recovery** — Timer recalculates from `openSegment.startAt` on every tick, so it shows the correct elapsed time even after a hard page refresh
- **Duplicate Session Guard** — Only one active session per employee at a time; stale sessions (>16h) are auto-expired
- **Missed Checkout Detection** — Daily cron scans for sessions still open from previous days, auto-closes them at 23:59, flags as missed checkout, and notifies the employee
- **Document ID Contract** — All Firestore documents created with `doc(id).set(data)` ensuring path ID always matches the stored `id` field

### Payroll System

- **Dual Overtime Models** — Daily threshold (8 hours/480 minutes) and weekly threshold (40 hours/2400 minutes); minutes above threshold flagged as overtime
- **Pay Calculation** — Regular pay (rate × regular minutes), overtime pay (rate × OT multiplier × OT minutes), gross pay, net pay after deductions
- **Configurable Rates** — Per-employee hourly rate (default $15/hr), overtime multiplier (default 1.5x), and weekly OT threshold
- **Period Payroll** — Calculate across ISO weeks or calendar months with embedded per-day breakdown
- **Payroll Run States** — Draft → Processed → Paid lifecycle with timestamp tracking at each transition
- **Conflict Prevention** — Prevents duplicate payroll runs for the same employee and period (409 Conflict)

### Timesheets

- **Auto-Generation** — Aggregate completed attendance sessions into weekly (Mon–Sun) or monthly timesheets
- **Submission Workflow** — Draft → Submitted → Approved/Rejected with reviewer name, notes, and timestamp
- **Day-Level Aggregation** — Each day shows session IDs, total work time, break time, and work status
- **Period Locking** — Admin locks a payroll period after finalization; locked periods block new corrections, timesheet edits, and session modifications
- **Smart Labels** — ISO week format (`2026-W15`) and month format (`2026-04`) for clear period identification

### Corrections & Audit Trail

- **Correction Fields** — Employees can request changes to clock-in time, clock-out time, session date, or status
- **Review Workflow** — Admin reviews with approve/reject action and optional note; approved changes are auto-applied to the session via transactional update
- **Immutable Audit Logs** — Every correction approval or rejection writes an audit entry with: correction ID, session ID, employee ID, admin ID, all changes, note, and timestamp
- **Duplicate Prevention** — Employees cannot submit a new correction for a session that already has a pending request
- **Locked Period Guard** — Corrections cannot be submitted for sessions in locked payroll periods

### Notifications

- **In-App Notification Bell** — Real-time unread count badge; scrollable notification list with mark-as-read (individual or bulk)
- **Notification Types** — `missed_checkout`, `correction_approved`, `correction_rejected`, `timesheet_approved`, `timesheet_rejected`, `payroll_processed`, `general`
- **Automatic Alerts** — Missed checkout detection triggers employee notification with link to attendance page
- **Cron Integration** — Daily cron job for missed checkout detection; weekly CEO summary report generation
- **Execution Logging** — All cron runs logged with job name, trigger source, start/end time, status, and summary

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14.2.5 (App Router) with React 18 |
| Language | TypeScript 5 (strict mode) |
| Authentication | Firebase Auth with Admin SDK for server-side verification |
| Database | Cloud Firestore with composite indexes and security rules |
| Styling | Tailwind CSS 3.4.4 with class-variance-authority |
| Icons | Lucide React |
| Forms | React Hook Form 7.72 + Zod 4.3 schema validation |
| State | Zustand 5.0 for client-side state management |
| Date/Time | date-fns 3.6 |
| Excel Export | ExcelJS 4.4 + XLSX 0.18 |
| PDF Export | jsPDF 4.2 |
| Toasts | Sonner |
| Deployment | Vercel (with cron support via vercel.json) |

---

## Project Structure

```
app/
├── (auth)/                      # Login / auth pages
├── (dashboard)/
│   ├── employee/                # Employee dashboard, attendance, corrections, timesheets, profile
│   ├── admin/                   # Admin dashboard, employees, attendance, payroll, reports
│   └── ceo/                     # CEO dashboard, payroll, reports
├── api/
│   ├── auth/                    # Login, logout, session, change-password
│   ├── attendance/              # start, pause, resume, end, current, history, corrections
│   ├── employees/               # CRUD + delete for employee management
│   ├── payroll/                 # Payroll runs, rates, weekly/monthly calculations
│   ├── timesheets/              # Generate, submit, review, lock
│   ├── notifications/           # Fetch + mark-as-read
│   ├── missed-checkouts/        # List + resolve
│   ├── admin/                   # Admin-only attendance and payroll endpoints
│   └── cron/                    # Missed checkout detection, CEO reports
components/
├── attendance/                  # AttendancePanel, history tables
├── employees/                   # AdminEmployeeList with add/edit/delete modals
├── payroll/                     # PayrollSummary, WeeklySummaryCard, MonthlySummaryCard
└── ui/                          # Shared UI primitives (Badge, Button, Dialog, etc.)
lib/
├── attendance/                  # Session state machine, Firestore queries, utilities
├── auth/                        # Role guards, session verification, middleware
├── corrections/                 # Correction request CRUD and review logic
├── firebase/                    # Firebase client + Admin SDK initialization
├── notifications/               # Notification CRUD, missed checkout detection engine
├── payroll/                     # Overtime calculator, pay calculation, payroll queries
├── timesheets/                  # Timesheet aggregation, period utilities, locking
└── api/                         # Shared helpers (safeParseBody, ok, badRequest, etc.)
types/
└── index.ts                     # All TypeScript interfaces and type definitions
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Firebase project with Firestore and Authentication enabled
- Vercel account (for deployment with cron support)

### Environment Variables

Create a `.env.local` file in the project root:

```env
# Firebase Client SDK
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin SDK
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=your_service_account_email
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Session
SESSION_SECRET=your_random_secret_key
```

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Firestore Setup

1. Deploy security rules: copy `firestore.rules` content into Firebase Console → Firestore → Rules → Publish
2. Deploy indexes: create composite indexes in Firebase Console → Firestore → Indexes (or use `firebase deploy --only firestore:indexes` if Firebase CLI is installed)

### Build

```bash
npm run build
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Sign in with email/password |
| POST | `/api/auth/logout` | Revoke session and clear cookie |
| GET | `/api/auth/session` | Verify current session |
| POST | `/api/auth/change-password` | Change password (requires current password) |

### Attendance
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/attendance/start` | Clock in (start work session) |
| POST | `/api/attendance/pause` | Start break |
| POST | `/api/attendance/resume` | End break, resume work |
| POST | `/api/attendance/end` | Clock out (end work session) |
| GET | `/api/attendance/current` | Get active session + open segment |
| GET | `/api/attendance/history` | Get sessions by date range |

### Employees
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/employees` | List all employees (admin/CEO) |
| POST | `/api/employees` | Create new employee (admin) |
| PATCH | `/api/employees` | Update employee details (admin) |
| DELETE | `/api/employees` | Permanently delete employee (admin) |

### Payroll
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/payroll` | List payroll runs |
| POST | `/api/payroll` | Generate payroll calculation |
| GET | `/api/payroll/[id]` | Get single payroll run |
| PATCH | `/api/payroll/[id]` | Update status or deductions |
| GET | `/api/payroll/rates` | Get all employee rates |
| PATCH | `/api/payroll/rates` | Update employee rate config |
| GET | `/api/payroll/weekly` | Weekly payroll summary |
| GET | `/api/payroll/monthly` | Monthly payroll summary |

### Timesheets
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/timesheets` | List timesheets |
| POST | `/api/timesheets` | Generate or submit timesheet |
| POST | `/api/timesheets/[id]/review` | Approve or reject timesheet |
| GET | `/api/timesheets/lock` | List payroll locks |
| POST | `/api/timesheets/lock` | Lock a payroll period |

### Other
| Method | Endpoint | Description |
|---|---|---|
| GET/PATCH | `/api/notifications` | Fetch or mark notifications as read |
| POST | `/api/missed-checkouts/[id]/resolve` | Resolve missed checkout |
| POST | `/api/attendance/corrections` | Submit correction request |
| POST | `/api/attendance/corrections/[id]/review` | Approve/reject correction |
| GET | `/api/admin/attendance` | All employee attendance (admin/CEO) |
| GET | `/api/admin/payroll` | All employee payroll data (admin/CEO) |

---

## Firestore Collections

| Collection | Description |
|---|---|
| `users` | Employee profiles with role, rate config |
| `attendance_sessions` | V2 work sessions (userId, workDate, status, clockInAt, clockOutAt, totalWorkMinutes, totalBreakMinutes) |
| `attendance_segments` | Work/break time blocks within sessions (sessionId, userId, type, startAt, endAt, durationMinutes, isOpen) |
| `payroll_runs` | Calculated payroll records with daily breakdown |
| `timesheets` | Weekly/monthly timesheet aggregations |
| `payroll_locks` | Immutable period lock records |
| `correction_requests` | Employee correction requests with review workflow |
| `audit_logs` | Immutable audit trail for corrections |
| `notifications` | In-app notification records |
| `missed_checkouts` | Flagged missed checkout records |
| `cron_runs` | Automated job execution logs |

---

## License

This project is proprietary software. All rights reserved.
