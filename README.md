# AgencyDesk

AgencyDesk is a workforce and operations dashboard for agencies. It connects attendance, timesheets, payroll, client projects, and finance in one Next.js application backed by Firebase. Built by [Tanvir Jahan](https://github.com/TanvirJahan001).

**[Explore the live admin demo](https://agency-desk-six.vercel.app/demo)** · [Sign in to AgencyDesk](https://agency-desk-six.vercel.app/login)

## Live demo

Select **Explore the live demo** on the login page or open **[/demo](https://agency-desk-six.vercel.app/demo)**. Visitors get the same dashboard layout, navigation, cards, and status tables as the admin area, with read-only views for:

- Employee and department directories
- Attendance history, timesheets, and payroll estimates
- Clients, projects, and project tasks
- Invoices, expenses, and finance summaries
- Leave requests and announcements

The demo uses sample records from Firestore. It requires no account and creates no authenticated session. It only reads reserved demo records tagged `agencydesk-demo-v1`. Public views return a limited set of display fields and omit contact information, private notes, and documents. The signed-in dashboards and their write operations require an authorized account.

## Product features

| Area | Features |
| --- | --- |
| Access | Firebase email/password sign-in, password reset, HttpOnly session cookies, and employee, admin, and CEO dashboards |
| Attendance | Start and end work, take and resume breaks, live timers, attendance history, corrections, and missed checkout review |
| Workforce | Employee and department management, onboarding and offboarding, profiles, leave balances and requests, shifts, schedules, holidays, and calendars |
| Payroll | Weekly and monthly payroll estimates, configurable hourly and overtime rates, payroll runs, deductions, payslips, and period locks |
| Timesheets | Weekly and monthly aggregation, submission and review, and day-by-day work and break summaries |
| Delivery | Client directory, project budgets, assignments, task boards, comments, time logs, and contract records |
| Finance | Invoices, expenses and approvals, revenue and profit summaries, and project tracking |
| Documents | Categorized links to externally hosted documents, employee assignment, access restrictions, and expiry dates |
| Operations | Announcements, in-app notifications, activity, audit logs, reports and exports, bulk operations, and scheduled job monitoring |

### Dashboard roles

- **Employee** — Clock in and out, review attendance or submit corrections, log project work, submit timesheets, request leave, report expenses, and view personal payroll, payslips, and documents.
- **Admin** — Manage employees, attendance, payroll, clients, projects, and finance. Use **Dashboard → My Attendance** or **Attendance → My Attendance** to record personal attendance. Use **Team Attendance** to review and filter team sessions.
- **CEO** — Review workforce, projects, payroll, finance, and operational reports through the executive dashboard. Available actions depend on the permissions of each feature.

## How it works

- The login form authenticates with Firebase Auth. The server exchanges the Firebase token for an HttpOnly session cookie, verifies the session, and looks up the role in the matching Firestore user profile.
- Attendance sessions contain work and break segments. Each action saves a state transition to Firestore, and the admin attendance page refreshes the team table after a successful personal attendance action.
- Timesheets aggregate attendance into reviewable periods. Payroll uses recorded work time and configured rates to calculate regular and overtime pay.
- The scheduled endpoints configured in [`vercel.json`](vercel.json) handle missed checkouts and weekly reporting. Job runs can be inspected in the dashboard.

## Technology

| Layer | Tools |
| --- | --- |
| Application | Next.js 16 App Router, React 19, TypeScript 5 |
| Data and authentication | Cloud Firestore, Firebase web SDK and Admin SDK |
| Interface | Tailwind CSS 3, Lucide React, Sonner |
| Forms and client state | React Hook Form, Zod, Zustand |
| Reports | ExcelJS, SheetJS, jsPDF |
| Hosting | Vercel and Vercel Cron |

## Run locally

Use Node.js **20.9 or newer**, npm, and a Firebase project with Firestore and the Email/Password sign-in provider enabled.

```bash
git clone https://github.com/TanvirJahan001/AgencyDesk.git
cd AgencyDesk
npm ci
cp .env.local.example .env.local
```

1. Add the Firebase web configuration for your project to `.env.local`. Configure server-side Firebase Admin credentials for the same project using one of the formats in the [Firebase setup guide](docks/FIREBASE_SETUP_GUIDE.md#4-environment-variables).
2. Deploy the Firestore rules and indexes. Select your project explicitly when using the Firebase CLI.

   ```bash
   firebase deploy --project YOUR_PROJECT_ID --only firestore:rules,firestore:indexes
   ```

3. Provision the first workspace user in Firebase Authentication, then create a `users/{uid}` Firestore document with the same UID, email, display name, and the `admin` role. Sign in with that account.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For a production build, run `npm run build` and then `npm start`. Keep local environment files and service-account JSON outside version control.

### Sample data

The hosted demo already has a fictional agency dataset. To populate a separate installation, create records in your own Firestore project with IDs starting with `demo-` and the field `demoDataset: "agencydesk-demo-v1"`. Use fictional data only, since these marked records are intended for the public demo. An empty dataset displays empty states. Use the existing `npm run seed` command only in a disposable development project; it creates development test users and records.

## Deploy to Vercel

1. Import the GitHub repository in Vercel and select `main` as the production branch.
2. Configure the Firebase web settings and server-side Firebase Admin credentials for the target environment. Store the Admin credential and any cron secret as server-side secrets.
3. Build or redeploy after changing environment settings. Open `/login` and `/demo` to verify the private sign-in and public demo routes.

See the [Firebase setup guide](docks/FIREBASE_SETUP_GUIDE.md#vercel-deployments) for environment setup and deployment details.

## Repository map

| Path | Contents |
| --- | --- |
| `app/(auth)` | Sign-in and password reset |
| `app/(dashboard)` | Authenticated employee, admin, and CEO dashboards |
| `app/demo` | Public, read-only admin demo |
| `app/api` | Authenticated application and scheduled route handlers |
| `components` | Dashboard layout, attendance controls, forms, and UI primitives |
| `lib` | Data access, authentication, attendance, payroll, and reporting logic |
| `types` | Shared TypeScript models |
| `firestore.rules` and `firestore.indexes.json` | Firestore rules and indexes |
| `scripts` | Development seed and report utilities |
| `docks` | Setup guides, architecture notes, and feature documentation |

For collections and relationships, see the [Firestore schema](docks/firestore-schema.md). For file metadata, access rules, and storage behavior, see the [document management guide](docks/DOCUMENT_MANAGEMENT_FEATURE.md).

## License

Proprietary software. All rights reserved.
