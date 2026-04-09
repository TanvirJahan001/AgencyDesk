# AgencyDesk — Firestore Database Schema

## Collection: `users`

Stores all employee and admin profiles. **Document ID = Firebase Auth UID**.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uid` | `string` | Yes | Firebase Auth UID (must match document ID) |
| `email` | `string` | Yes | Login email |
| `displayName` | `string` | Yes | Full name |
| `role` | `string` | Yes | `"admin"` or `"employee"` |
| `department` | `string` | No | e.g. `"Engineering"`, `"HR"`, `"Finance"` |
| `position` | `string` | No | e.g. `"Software Engineer"`, `"Manager"` |
| `photoURL` | `string` | No | Profile image URL |
| `createdAt` | `string` | Yes | ISO 8601 timestamp |

### Access Rules

| Action | Admin | Employee |
|--------|-------|----------|
| Read any user | Yes | Own doc only |
| Create user | Yes | No |
| Update any user | Yes (all fields) | Own doc (`displayName`, `photoURL` only) |
| Delete user | Yes | No |

### Example Document

```json
{
  "uid": "abc123xyz",
  "email": "jane@company.com",
  "displayName": "Jane Smith",
  "role": "employee",
  "department": "Engineering",
  "position": "Senior Developer",
  "photoURL": null,
  "createdAt": "2026-04-08T00:00:00Z"
}
```

---

## Collection: `attendance`

One document per employee per day. **Document ID = auto-generated or `{uid}_{date}`**.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Document ID |
| `employeeId` | `string` | Yes | References `users/{uid}` |
| `date` | `string` | Yes | `YYYY-MM-DD` format |
| `clockIn` | `string` | No | ISO 8601 timestamp |
| `clockOut` | `string` | No | ISO 8601 timestamp |
| `status` | `string` | Yes | `"present"`, `"absent"`, `"late"`, `"half-day"`, `"holiday"` |
| `hoursWorked` | `number` | No | Decimal hours (calculated from clockIn/clockOut) |
| `notes` | `string` | No | Manager or employee notes |

### Access Rules

| Action | Admin | Employee |
|--------|-------|----------|
| Read records | All | Own only |
| Create record | Yes | Own only (clock in) |
| Update record | Any record | Own only (clock out/notes). Cannot change `employeeId`, `id`, `date` |
| Delete record | Yes | No |

### Example Document

```json
{
  "id": "abc123xyz_2026-04-08",
  "employeeId": "abc123xyz",
  "date": "2026-04-08",
  "clockIn": "2026-04-08T09:02:00Z",
  "clockOut": "2026-04-08T17:35:00Z",
  "status": "present",
  "hoursWorked": 8.55,
  "notes": null
}
```

---

## Collection: `payroll`

One document per employee per pay period. Admin-managed only.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Document ID |
| `employeeId` | `string` | Yes | References `users/{uid}` |
| `period` | `string` | Yes | `YYYY-MM` format |
| `baseSalary` | `number` | Yes | Monthly base salary amount |
| `overtime` | `number` | Yes | Overtime pay amount |
| `deductions` | `number` | Yes | Tax and other deductions |
| `netPay` | `number` | Yes | `baseSalary + overtime - deductions` |
| `status` | `string` | Yes | `"draft"`, `"processed"`, `"paid"` |
| `processedAt` | `string` | No | ISO 8601 (set when status → "processed") |
| `paidAt` | `string` | No | ISO 8601 (set when status → "paid") |

### Access Rules

| Action | Admin | Employee |
|--------|-------|----------|
| Read records | All | Own only |
| Create record | Yes | No |
| Update record | Yes | No |
| Delete record | Yes | No |

### Example Document

```json
{
  "id": "abc123xyz_2026-03",
  "employeeId": "abc123xyz",
  "period": "2026-03",
  "baseSalary": 4000,
  "overtime": 350,
  "deductions": 500,
  "netPay": 3850,
  "status": "paid",
  "processedAt": "2026-03-28T10:00:00Z",
  "paidAt": "2026-03-31T12:00:00Z"
}
```

---

## Indexes

Create these composite indexes in the Firebase Console under Firestore → Indexes:

| Collection | Fields | Query Scope |
|------------|--------|-------------|
| `attendance` | `employeeId` ASC, `date` DESC | Collection |
| `attendance` | `date` ASC, `status` ASC | Collection |
| `payroll` | `employeeId` ASC, `period` DESC | Collection |
| `payroll` | `period` ASC, `status` ASC | Collection |

---

## Auth Flow Summary

```
Login Page
    ↓
Firebase Client SDK  →  signInWithEmailAndPassword()
    ↓
ID Token  →  POST /api/auth/session
    ↓
Firebase Admin SDK   →  verifyIdToken()
    ↓
Firestore Lookup     →  /users/{uid}.role
    ↓
Session Cookie       →  httpOnly "session" + "__role"
    ↓
Redirect             →  /admin  or  /employee
```
