# Audit Log Viewer Implementation

## Overview

The Audit Log Viewer feature provides a comprehensive audit trail for all administrative actions and state mutations in AgencyDesk. This implementation includes:

- Enhanced types supporting 16+ action types
- Server-side logger utility for writing audit logs
- Admin/CEO-only API endpoint with filtering
- Full-featured React client with filters, pagination, CSV export, and detail expansion
- Navigation integration for both admin and CEO roles

## Implementation Details

### 1. Updated Types (`types/index.ts`)

**Status: COMPLETE**

Enhanced the `AuditLog` interface to support:

```typescript
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
  metadata?:     Record<string, unknown>;
  timestamp:     string;
}
```

**Key changes:**
- Made most fields optional with `?`
- Added `metadata` for extensible context
- Expanded type union from 3 to 16 action types
- Updated `changes` to be optional (not all actions have changes)

### 2. Audit Logger Utility (`lib/audit/logger.ts`)

**Status: COMPLETE**

Reusable function for server-side audit log writing:

```typescript
export async function writeAuditLog(
  log: Omit<AuditLog, "id" | "timestamp">
): Promise<AuditLog> {
  const id = adminDb.collection("audit_logs").doc().id;
  const entry: AuditLog = {
    ...log,
    id,
    timestamp: new Date().toISOString(),
  };
  await adminDb.collection("audit_logs").doc(id).set(entry);
  return entry;
}
```

**Usage in API routes or server actions:**

```typescript
import { writeAuditLog } from "@/lib/audit/logger";

// After a correction is approved
await writeAuditLog({
  type: "correction_approved",
  correctionId: "corr_123",
  sessionId: "sess_456",
  employeeId: "emp_789",
  adminId: "admin_001",
  adminName: "John Doe",
  changes: [...],
  note: "Approved due to verified doctor's appointment",
});
```

### 3. API Endpoint (`app/api/audit-logs/route.ts`)

**Status: COMPLETE**

GET endpoint for fetching audit logs with optional filtering.

**Authentication:** Admin/CEO only (via session cookie)

**Query Parameters:**
- `type` - Filter by action type (optional)
- `employeeId` - Filter by employee ID (optional)
- `from` - ISO 8601 timestamp, date range start (optional)
- `to` - ISO 8601 timestamp, date range end (optional)
- `limit` - Number of logs to return (default: 100, max: 500)

**Example requests:**

```bash
# Get all logs from the past week, limit 100
GET /api/audit-logs?limit=100

# Get corrections for employee emp_123
GET /api/audit-logs?employeeId=emp_123&type=correction_approved

# Get logs in date range
GET /api/audit-logs?from=2026-04-01T00:00:00Z&to=2026-04-09T23:59:59Z

# Combine filters
GET /api/audit-logs?type=employee_created&from=2026-04-01T00:00:00Z&limit=500
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "audit_abc123",
      "type": "correction_approved",
      "correctionId": "corr_456",
      "sessionId": "sess_789",
      "employeeId": "emp_001",
      "adminId": "admin_abc",
      "adminName": "Jane Smith",
      "changes": [
        {
          "field": "clockIn",
          "oldValue": "09:15",
          "newValue": "08:55"
        }
      ],
      "note": "Approved due to verified appointment",
      "timestamp": "2026-04-09T14:32:00.000Z"
    }
  ]
}
```

**Features:**
- Role-based access control (admin/ceo only)
- Type filtering (exact match)
- Employee ID filtering
- Date range filtering (from/to in ISO format)
- Limit pagination support
- Proper error handling with 401/403/400/500 responses

### 4. Admin UI Client (`app/(dashboard)/admin/audit-logs/AuditLogViewerClient.tsx`)

**Status: COMPLETE**

Full-featured React component with:

**Features:**

1. **Filter Bar**
   - Log type dropdown (all 16 types)
   - Employee ID text input
   - From/To date range inputs (datetime-local)
   - Apply Filters button
   - Reset button
   - Export CSV button

2. **Logs Table**
   - Timestamp (formatted with `toLocaleString()`)
   - Type (color-coded badges)
   - Admin name
   - Employee ID (or "—" if N/A)
   - Auto-generated description
   - Expandable details button

3. **Expandable Row Details**
   - Log ID, Correction ID, Session ID, Note
   - Changes list with old → new values (struck through old, green new)
   - Metadata JSON preview (if present)

4. **Pagination**
   - 50 logs per page
   - Previous/Next buttons
   - Current page indicator

5. **CSV Export**
   - Downloads filtered logs as CSV
   - Columns: ID, Timestamp, Type, Admin, Employee ID, Correction ID, Session ID, Note
   - Filename: `audit-logs-YYYY-MM-DD.csv`

6. **Loading/Error States**
   - Spinner during fetch
   - Error banner with icon
   - Empty state message

**Badge Colors:**
- Green: Approvals, paid operations (correction_approved, leave_approved, etc.)
- Red: Rejections, deletions (correction_rejected, leave_rejected, employee_deleted)
- Blue: Creates (employee_created, contract_created)
- Gray: Updates, modifications (employee_updated, session_modified, settings_updated)
- Purple: Payroll processed
- Orange: Bulk operations

### 5. Admin Page (`app/(dashboard)/admin/audit-logs/page.tsx`)

**Status: COMPLETE**

Server component that wraps the client:
- Title: "Audit Logs"
- Description: "View system-wide audit trail..."
- Renders `AuditLogViewerClient`

### 6. CEO Page (`app/(dashboard)/ceo/audit-logs/page.tsx`)

**Status: COMPLETE**

Reuses the same client component from admin. CEO has same privileges as admin for audit logs.

### 7. Sidebar Navigation (`components/layout/Sidebar.tsx`)

**Status: COMPLETE**

Added two nav items:

```typescript
// Admin section
{ label: "Audit Logs",           href: "/admin/audit-logs",     icon: FileBarChart,    roles: ["admin"] },

// CEO section  
{ label: "Audit Logs",           href: "/ceo/audit-logs",       icon: FileBarChart,    roles: ["ceo"] },
```

Placed after "Cron Logs" in both sections.

### 8. Firestore Rules

**Status: VERIFIED**

Rules already exist in `firestore.rules`:

```
match /audit_logs/{logId} {
  allow read: if isPrivileged();  // admin/ceo only
  allow create, update, delete: if false;  // server-side writes only
}
```

No changes needed.

## Integration with Existing Code

### Where to Call `writeAuditLog()`

Add audit logging to any existing API route or server action that performs state mutations:

**Example 1: Correction Approval (in `/api/corrections/approve/route.ts`)**

```typescript
import { writeAuditLog } from "@/lib/audit/logger";

export async function POST(req: NextRequest) {
  // ... existing validation ...
  
  // After approving the correction:
  await adminDb.collection("corrections").doc(correctionId).update({
    status: "approved",
    reviewedBy: admin.uid,
  });
  
  // Log the action
  await writeAuditLog({
    type: "correction_approved",
    correctionId,
    sessionId: correction.sessionId,
    employeeId: correction.employeeId,
    adminId: admin.uid,
    adminName: admin.displayName || admin.email || "Unknown",
    changes: correction.changes,
    note: req_body.note,
  });
  
  return ok({ success: true });
}
```

**Example 2: Employee Creation (in `/api/employees/create/route.ts`)**

```typescript
import { writeAuditLog } from "@/lib/audit/logger";

export async function POST(req: NextRequest) {
  // ... create employee ...
  
  await writeAuditLog({
    type: "employee_created",
    employeeId: newEmployee.id,
    adminId: admin.uid,
    adminName: admin.displayName,
    metadata: {
      email: newEmployee.email,
      department: newEmployee.department,
    },
    note: "Employee onboarded via admin panel",
  });
}
```

**Example 3: Payroll Processing**

```typescript
await writeAuditLog({
  type: "payroll_processed",
  adminId: admin.uid,
  adminName: admin.displayName,
  metadata: {
    periodStart: "2026-04-01",
    periodEnd: "2026-04-30",
    employeesProcessed: 45,
    totalAmount: 125000.50,
  },
  note: "Monthly payroll run for April 2026",
});
```

## Testing

### Manual Testing Steps

1. **Check Admin Page:**
   - Navigate to `/admin/audit-logs`
   - Should render filter bar, empty state initially

2. **Populate Sample Data:**
   - Use Firestore console to add test audit logs:
   ```javascript
   db.collection("audit_logs").add({
     id: "test_001",
     type: "correction_approved",
     correctionId: "corr_123",
     sessionId: "sess_456",
     employeeId: "emp_789",
     adminId: "admin_001",
     adminName: "Test Admin",
     changes: [
       { field: "clockIn", oldValue: "09:15", newValue: "08:55" }
     ],
     note: "Test log entry",
     timestamp: new Date().toISOString()
   })
   ```

3. **Test Filtering:**
   - Type dropdown: select "Correction Approved"
   - Employee ID: type an employee ID
   - Date range: select dates
   - Click "Apply Filters"
   - Verify table updates

4. **Test Pagination:**
   - Add 100+ logs
   - Verify "Next" button appears
   - Click through pages

5. **Test Export:**
   - Click "Export CSV"
   - Verify CSV downloads with correct headers and data

6. **Test Expandable Details:**
   - Click chevron on a row
   - Verify details appear below with all fields

7. **Test CEO Access:**
   - Navigate to `/ceo/audit-logs`
   - Should render identically to admin version

8. **Test Access Control:**
   - Try accessing as employee (should redirect or show 403)
   - Try without session cookie (should redirect to login)

### API Testing with cURL

```bash
# Get all logs
curl -X GET "http://localhost:3000/api/audit-logs" \
  -H "Cookie: session=<your_session_cookie>"

# Filter by type
curl -X GET "http://localhost:3000/api/audit-logs?type=correction_approved" \
  -H "Cookie: session=<your_session_cookie>"

# Filter by date range
curl -X GET "http://localhost:3000/api/audit-logs?from=2026-04-01T00:00:00Z&to=2026-04-09T23:59:59Z" \
  -H "Cookie: session=<your_session_cookie>"

# Combine filters
curl -X GET "http://localhost:3000/api/audit-logs?type=employee_created&limit=50" \
  -H "Cookie: session=<your_session_cookie>"
```

## Type Descriptions

### Log Types (16 total)

| Type | Badge Color | Description |
|------|-------------|-------------|
| `correction_approved` | Green | Time correction was approved |
| `correction_rejected` | Red | Time correction was rejected |
| `session_modified` | Gray | Attendance session manually edited |
| `employee_created` | Blue | New employee added |
| `employee_updated` | Gray | Employee record modified |
| `employee_deleted` | Red | Employee removed |
| `leave_approved` | Green | Leave request approved |
| `leave_rejected` | Red | Leave request rejected |
| `expense_approved` | Green | Expense claim approved |
| `expense_rejected` | Red | Expense claim rejected |
| `payroll_processed` | Purple | Payroll batch processed |
| `payroll_paid` | Green | Payroll paid out |
| `contract_created` | Blue | New contract created |
| `contract_updated` | Gray | Contract modified |
| `settings_updated` | Gray | System settings changed |
| `bulk_operation` | Orange | Bulk action performed |

## File Structure

```
lib/
  audit/
    logger.ts                    (NEW - reusable audit logger)
app/
  api/
    audit-logs/
      route.ts                   (NEW - API endpoint)
  (dashboard)/
    admin/
      audit-logs/
        page.tsx                 (NEW - server wrapper)
        AuditLogViewerClient.tsx (NEW - client component)
    ceo/
      audit-logs/
        page.tsx                 (NEW - server wrapper, reuses admin client)
types/
  index.ts                        (UPDATED - AuditLog interface)
components/
  layout/
    Sidebar.tsx                  (UPDATED - added nav items)
```

## Performance Considerations

1. **Firestore Queries:** The API fetches up to 500 logs and filters by date range in memory. For datasets > 10k logs, consider:
   - Adding Firestore composite indexes for (type, timestamp) and (employeeId, timestamp)
   - Implementing server-side date range filtering via Firestore

2. **Pagination:** Client displays 50 logs per page to avoid performance issues with large result sets

3. **CSV Export:** Currently limited to filtering results (max 500). For larger exports, consider chunking

4. **Real-time Updates:** The current implementation fetches on-demand. To add real-time updates:
   - Use Firestore snapshot listener
   - Add auto-refresh toggle (similar to Cron Logs)

## Security Notes

1. **Access Control:** Only admin/ceo can access audit logs (enforced in both API and Firestore rules)
2. **Write Protection:** Audit logs can only be written by server-side code, never by clients
3. **Immutability:** Firestore rules prevent update/delete of existing logs
4. **Data Sensitivity:** Audit logs may contain sensitive data; ensure proper data retention policies

## Future Enhancements

1. **Webhooks:** Notify external systems on critical audit events
2. **Full-Text Search:** Add searchable description/note field
3. **Alerts:** Trigger notifications for suspicious patterns (e.g., mass deletions)
4. **Retention Policies:** Auto-delete logs older than N days
5. **Advanced Analytics:** Charts/stats on audit events by type/admin/employee
6. **Compliance Reports:** Generate compliance-ready audit reports
7. **Real-time Streaming:** WebSocket updates for live monitoring
