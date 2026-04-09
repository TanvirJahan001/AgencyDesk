# Audit Logging Integration Checklist

Use this checklist when integrating audit logging into existing API routes and features.

## For Each API Route/Action That Modifies Data

### Step 1: Import the Logger
```typescript
import { writeAuditLog } from "@/lib/audit/logger";
```

### Step 2: After State Mutation, Log It
Call `writeAuditLog()` with appropriate fields:

```typescript
// Get current user/admin info
const adminId = req.user.uid;      // or from session
const adminName = req.user.name;   // or email fallback

// Log the action
await writeAuditLog({
  type: "...",              // Pick from TYPE list below
  employeeId: "...",        // If applicable
  correctionId: "...",      // If applicable
  sessionId: "...",         // If applicable
  adminId,
  adminName,
  changes: [...],           // If modifying fields
  note: "...",              // Optional context
  metadata: { ... },        // Optional extra data
});
```

### Step 3: Avoid Duplicates
- Place `writeAuditLog()` immediately after the state mutation succeeds
- Only log if the operation completes successfully (after all updates)
- Don't log before the mutation (can't know if it succeeded)

## Log Type Mapping

**Corrections Flow:**
- ✓ `correction_approved` — in `/api/corrections/approve` after status update
- ✓ `correction_rejected` — in `/api/corrections/reject` after status update

**Attendance:**
- ✓ `session_modified` — in `/api/attendance/[id]/update` or `/api/admin/attendance`

**Employee Management:**
- ✓ `employee_created` — in `/api/employees/create` or `/api/onboarding/create-employee`
- ✓ `employee_updated` — in `/api/employees/[id]/update` or bulk update endpoints
- ✓ `employee_deleted` — in `/api/employees/[id]/delete` or offboarding endpoints

**Leave Management:**
- ✓ `leave_approved` — in `/api/leave/[id]/approve`
- ✓ `leave_rejected` — in `/api/leave/[id]/reject`

**Expenses:**
- ✓ `expense_approved` — in `/api/expenses/[id]/approve`
- ✓ `expense_rejected` — in `/api/expenses/[id]/reject`

**Payroll:**
- ✓ `payroll_processed` — in `/api/payroll/process` or cron job
- ✓ `payroll_paid` — in `/api/payroll/[id]/pay` or bulk payment endpoints

**Contracts:**
- ✓ `contract_created` — in `/api/contracts/create`
- ✓ `contract_updated` — in `/api/contracts/[id]/update`

**Settings:**
- ✓ `settings_updated` — in `/api/settings/[key]/update` or admin config endpoints

**Bulk Operations:**
- ✓ `bulk_operation` — in `/api/bulk/*` endpoints for mass updates

## Quick Integration Template

```typescript
// File: app/api/{feature}/{action}/route.ts

import { writeAuditLog } from "@/lib/audit/logger";
import { verifySessionCookie } from "@/lib/auth/withRoleGuard";
import { adminDb } from "@/lib/firebase/admin";
import { unauthorized, forbidden, serverError, ok } from "@/lib/api/helpers";

export async function POST(req: NextRequest) {
  // 1. Auth
  const cookie = req.cookies.get("session")?.value;
  if (!cookie) return unauthorized();
  const auth = await verifySessionCookie(cookie);
  if (!auth) return unauthorized();
  if (auth.role !== "admin" && auth.role !== "ceo") return forbidden();

  try {
    // 2. Parse request
    const body = await req.json();
    const { targetId, newValue, note } = body;

    // 3. Perform mutation
    const oldValue = "...";  // Get from DB if needed
    await adminDb.collection("...").doc(targetId).update({
      field: newValue,
      updatedAt: new Date().toISOString(),
    });

    // 4. Log the action ← IMPORTANT
    await writeAuditLog({
      type: "...",                    // e.g., "employee_updated"
      adminId: auth.uid,
      adminName: auth.displayName || auth.email || "Unknown",
      employeeId: "...",              // If applicable
      changes: [{                      // If modifying fields
        field: "field",
        oldValue,
        newValue,
      }],
      note: note || null,
      metadata: {                      // Optional context
        targetId,
        reason: "...",
      },
    });

    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
```

## Key Field Notes

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `type` | Yes | string | Choose from 16 types above |
| `adminId` | Yes | string | From auth.uid or session |
| `adminName` | Yes | string | From auth.displayName or email |
| `employeeId` | No | string | Filter by employee in viewer |
| `correctionId` | No | string | Link to correction record |
| `sessionId` | No | string | Link to attendance session |
| `changes` | No | CorrectionChange[] | Array of {field, oldValue, newValue} |
| `note` | No | string\|null | Admin comment or reason |
| `metadata` | No | object | Any extra context (will be JSON stringified) |

## Testing Audit Logs After Integration

1. **Firestore Console**
   - Go to `audit_logs` collection
   - Verify new logs appear within seconds
   - Check fields are populated correctly

2. **Audit Log Viewer**
   - Navigate to `/admin/audit-logs`
   - Filter by the type you just logged
   - Verify log appears with correct info

3. **CSV Export**
   - Apply filters
   - Click "Export CSV"
   - Verify file contains your new logs

## Common Mistakes to Avoid

❌ **Logging before state mutation:**
```typescript
// WRONG - log might succeed but mutation fail
await writeAuditLog({ ... });
await db.collection(...).update({ ... });
```

✓ **Correct order:**
```typescript
await db.collection(...).update({ ... });
await writeAuditLog({ ... });
```

---

❌ **Using hardcoded admin names:**
```typescript
// WRONG - loses who actually did it
adminName: "System"
```

✓ **Use actual admin info:**
```typescript
adminName: auth.displayName || auth.email || "Unknown"
```

---

❌ **Forgetting optional ID fields:**
```typescript
// WRONG - can't filter by employee later
await writeAuditLog({
  type: "employee_updated",
  adminId: "...",
  adminName: "...",
  // missing: employeeId
});
```

✓ **Include relevant IDs:**
```typescript
await writeAuditLog({
  type: "employee_updated",
  adminId: "...",
  adminName: "...",
  employeeId: employeeId,  // ← include this
});
```

---

❌ **Logging on error:**
```typescript
try {
  await db.update(...);
} catch (err) {
  await writeAuditLog({ ... });  // WRONG - mutation failed
  throw err;
}
```

✓ **Only log successful mutations:**
```typescript
try {
  await db.update(...);
  await writeAuditLog({ ... });  // ← after success
} catch (err) {
  throw err;  // Don't log failures
}
```

## Where to Start

If integrating into existing code, prioritize high-value endpoints:

1. **Highest Priority** (most impact, used frequently)
   - Correction approvals (`/api/corrections/approve`)
   - Employee operations (`/api/employees/create`, update, delete)
   - Payroll processing (`/api/payroll/process`)

2. **High Priority** (important operations)
   - Leave approvals/rejections
   - Expense approvals/rejections
   - Settings updates

3. **Medium Priority** (useful context)
   - Attendance corrections
   - Contract management
   - Bulk operations

4. **Lower Priority** (nice to have)
   - Individual session modifications (if high volume)
   - Non-critical admin actions

## Questions?

Refer to:
- **Implementation Details:** `AUDIT_LOG_VIEWER_IMPLEMENTATION.md`
- **Type Definitions:** `types/index.ts` (AuditLog interface)
- **Logger Function:** `lib/audit/logger.ts`
- **API Route:** `app/api/audit-logs/route.ts`
- **UI Component:** `app/(dashboard)/admin/audit-logs/AuditLogViewerClient.tsx`
