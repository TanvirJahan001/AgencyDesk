# AgencyDesk — Firebase Setup Guide

## Project Details

| Key | Value |
|-----|-------|
| Project ID | `attendpay-e278f` |
| Auth Domain | `attendpay-e278f.firebaseapp.com` |
| Console URL | https://console.firebase.google.com/project/attendpay-e278f |

---

## 1. Firebase Console Setup

### 1.1 Enable Authentication

1. Go to **Firebase Console** > **Authentication** > **Sign-in method**
   - Direct link: https://console.firebase.google.com/project/attendpay-e278f/authentication/providers
2. Enable **Email/Password** provider
3. Leave "Email link (passwordless sign-in)" disabled unless you need it

### 1.2 Create Firestore Database

1. Go to **Firebase Console** > **Firestore Database**
   - Direct link: https://console.firebase.google.com/project/attendpay-e278f/firestore
2. Click **Create database**
3. Choose your preferred location (e.g., `us-central1` or `asia-southeast1`)
4. Start in **Production mode** (our security rules will handle access control)

---

## 2. Deploy Security Rules

Your security rules file is at `firestore.rules`. Deploy them using Firebase CLI:

```bash
firebase deploy --only firestore:rules
```

This enforces role-based access:
- **Admin**: Full read/write on all collections
- **CEO**: Read-only on all collections (same as admin for reads)
- **Employee**: Read/write own data only

---

## 3. Deploy Firestore Indexes

Your composite indexes are defined in `firestore.indexes.json` (35 indexes across all collections). Deploy them:

```bash
firebase deploy --only firestore:indexes
```

This will take 5-10 minutes while Firebase builds the indexes. You can monitor progress at:
https://console.firebase.google.com/project/attendpay-e278f/firestore/indexes

> **Note:** The app will work without indexes, but queries that require composite indexes will fail with a Firestore error that includes a direct link to create the missing index. The deploy command creates them all at once.

---

## 4. Environment Variables

Your `.env.local` is already configured. Here's what each variable does:

### Client SDK (Public — safe for browser)

```
NEXT_PUBLIC_FIREBASE_API_KEY         — Firebase Web API key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN     — Auth domain for OAuth redirects
NEXT_PUBLIC_FIREBASE_PROJECT_ID      — Your project ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET  — Cloud Storage bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID — FCM sender ID
NEXT_PUBLIC_FIREBASE_APP_ID          — Web app identifier
```

### Admin SDK (Server-only — NEVER expose to browser)

```
FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON  — Full service account JSON (single line)
```

The Admin SDK initializes from this JSON string in `lib/firebase/admin.ts`. It also supports individual environment variables as a fallback:
```
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
```

### App Settings

```
NEXTAUTH_SECRET  — Session encryption key (generate with: openssl rand -base64 32)
NEXTAUTH_URL     — Your app's base URL (http://localhost:3000 for dev)
```

---

## 5. Seed the Database

The seed script creates all test data including Firebase Auth users and Firestore documents.

### Prerequisites

```bash
npm install
```

### Run the Seed Script

```bash
npm run seed
```

This creates:

| Collection | Records | Description |
|------------|---------|-------------|
| **users** | 7 | 1 admin, 1 CEO, 5 employees |
| **attendance_sessions** | ~75 | 3 weeks of daily sessions per employee |
| **attendance_segments** | ~225 | work/break segments per session |
| **timesheets** | 10 | Weekly + monthly per employee |
| **payroll_runs** | 5 | Monthly processed payroll |
| **payroll_locks** | 5 | One lock per payroll period |
| **invoices** | 5 | Auto-calculated line items |
| **correction_requests** | 3 | Approved, pending, rejected |
| **audit_logs** | 2 | Correction approval trail |
| **missed_checkouts** | 2 | Pending + resolved |
| **notifications** | ~17 | Various types per employee |
| **cron_runs** | 3 | Job execution logs |

### Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@attendpay.com | Admin@123 |
| CEO | ceo@attendpay.com | Ceo@12345 |
| Employee 1 | emp1@attendpay.com | Employee@123 |
| Employee 2 | emp2@attendpay.com | Employee@123 |
| Employee 3 | emp3@attendpay.com | Employee@123 |
| Employee 4 | emp4@attendpay.com | Employee@123 |
| Employee 5 | emp5@attendpay.com | Employee@123 |

### Re-running the Seed

The script is safe to re-run:
- Auth users are created with `createUser()` — if the user already exists by email, it will catch the error and use the existing UID
- Firestore user docs use `{ merge: true }` so existing fields are preserved
- Other documents use `set()` with deterministic IDs, so they overwrite cleanly

---

## 6. Verify Setup

After seeding, verify everything works:

### 6.1 Check Firestore Data

Go to https://console.firebase.google.com/project/attendpay-e278f/firestore/data

You should see all 12+ collections with documents.

### 6.2 Check Auth Users

Go to https://console.firebase.google.com/project/attendpay-e278f/authentication/users

You should see 7 users (admin, ceo, emp1-5).

### 6.3 Test the App Locally

```bash
npm run dev
```

1. Open http://localhost:3000
2. Log in with `admin@attendpay.com` / `Admin@123`
3. Check the dashboard shows attendance data
4. Navigate to Invoices, Reports, Cron Logs
5. Log out and test with `emp1@attendpay.com` / `Employee@123`

---

## 7. Hosting Deployment (Hostinger)

### 7.1 Build for Production

```bash
npm run build
```

### 7.2 Environment Variables on Hostinger

Set all variables from `.env.local` in your Hostinger hosting panel:
- Go to **hPanel** > **Advanced** > **Environment Variables** (or `.env` file depending on your plan)
- Copy all variables from `.env.local`
- Change `NEXTAUTH_URL` to your production domain (e.g., `https://attendpay.yourdomain.com`)
- Generate a new `NEXTAUTH_SECRET` for production: `openssl rand -base64 32`

### 7.3 Cron Jobs on Hostinger

AgencyDesk has two cron endpoints that need periodic execution:

**Missed Checkout Detection** — runs daily at midnight:
```
URL:  https://yourdomain.com/api/cron/missed-checkout
Method: POST
Header: x-cron-secret: <your-CRON_SECRET>
Schedule: 0 0 * * * (daily at midnight)
```

**Invoice Maintenance** — runs daily at 1 AM:
```
URL:  https://yourdomain.com/api/cron/invoice-maintenance
Method: POST
Header: x-cron-secret: <your-CRON_SECRET>
Schedule: 0 1 * * * (daily at 1 AM)
```

Add `CRON_SECRET` to your environment variables (any random string), then configure these as cron jobs in Hostinger's cron job panel. If Hostinger only supports `wget`/`curl` crons:

```bash
curl -X POST -H "x-cron-secret: YOUR_SECRET_HERE" https://yourdomain.com/api/cron/missed-checkout
```

---

## 8. Firebase CLI Reference

Common commands you'll use:

```bash
# Set active project
firebase use default

# Deploy everything (rules + indexes)
firebase deploy --only firestore

# Deploy only security rules
firebase deploy --only firestore:rules

# Deploy only indexes
firebase deploy --only firestore:indexes

# List projects
firebase projects:list

# Check current project
firebase use
```

---

## 9. Collections Reference

| Collection | Purpose | Access |
|------------|---------|--------|
| `users` | Employee profiles, roles, pay rates | Owner + Admin |
| `attendance_sessions` | Daily clock-in/out records (V2) | Owner + Admin/CEO |
| `attendance_segments` | Work/break time segments (V2) | Owner + Admin/CEO |
| `timesheets` | Weekly/monthly timesheet summaries | Owner + Admin |
| `payroll_runs` | Processed payroll calculations | Owner + Admin |
| `payroll_locks` | Period lock records (immutable) | All authenticated |
| `invoices` | Generated invoices with line items | Owner + Admin/CEO |
| `correction_requests` | Employee time correction requests | Owner + Admin |
| `audit_logs` | Immutable audit trail | Admin/CEO only |
| `notifications` | User notifications | Owner + Admin/CEO |
| `missed_checkouts` | Auto-detected missed checkouts | Owner + Admin |
| `cron_runs` | Cron job execution logs | Admin/CEO only |
| `attendance` | Legacy V1 data (read-only) | Owner + Admin/CEO |
| `payroll` | Legacy V1 data (read-only) | Admin/CEO only |

---

## Troubleshooting

**"Missing or insufficient permissions"**
- Ensure Firestore security rules are deployed: `firebase deploy --only firestore:rules`
- Check that the user's `role` field in the `users` collection is set correctly

**"The query requires an index"**
- Deploy indexes: `firebase deploy --only firestore:indexes`
- Or click the link in the error message to create the specific index in Console

**Seed script fails with "auth/email-already-exists"**
- This is normal on re-runs — the script catches this error and continues

**"No currently active project"**
- Run `firebase use default` or `firebase use attendpay-e278f`

**Admin SDK initialization fails**
- Verify `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` in `.env.local` is valid JSON on a single line
- Check the service account has Firestore and Auth permissions
