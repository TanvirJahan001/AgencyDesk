# Audit Log Viewer - Quick Reference

## Accessing the Feature

**Admin:** `/admin/audit-logs`  
**CEO:** `/ceo/audit-logs`

Both routes render the same full-featured audit log viewer component.

## Adding Audit Logging to an Endpoint

### Step 1: Import
```typescript
import { writeAuditLog } from "@/lib/audit/logger";
```

### Step 2: After State Mutation
```typescript
await writeAuditLog({
  type: "correction_approved",  // Pick one of 16 types
  adminId: auth.uid,            // From session
  adminName: auth.displayName,  // From session
  employeeId: "emp_123",        // If applicable
  note: "Approved per request",
});
```

## Log Types

```
Approvals/Rejections:
  correction_approved, correction_rejected
  leave_approved, leave_rejected
  expense_approved, expense_rejected
  payroll_paid

Creates:
  employee_created, contract_created

Updates:
  employee_updated, session_modified, contract_updated, settings_updated

Other:
  payroll_processed, bulk_operation, employee_deleted
```

## API Endpoint

**GET** `/api/audit-logs`

**Query Parameters:**
- `type` - Filter by log type
- `employeeId` - Filter by employee
- `from` - ISO 8601 timestamp start
- `to` - ISO 8601 timestamp end
- `limit` - 1-500 (default 100)

**Example:**
```
/api/audit-logs?type=correction_approved&employeeId=emp_123&limit=50
```

## File Locations

| File | Purpose |
|------|---------|
| `lib/audit/logger.ts` | Write audit logs |
| `app/api/audit-logs/route.ts` | Fetch audit logs |
| `app/(dashboard)/admin/audit-logs/` | Admin UI |
| `app/(dashboard)/ceo/audit-logs/` | CEO UI |
| `types/index.ts` | AuditLog interface |
| `components/layout/Sidebar.tsx` | Navigation |

## Documentation

| Document | Purpose |
|----------|---------|
| `AUDIT_LOG_VIEWER_IMPLEMENTATION.md` | Complete guide |
| `AUDIT_LOGGING_INTEGRATION_CHECKLIST.md` | Integration template |
| `AUDIT_LOG_VIEWER_BUILD_SUMMARY.md` | Feature overview |
| `QUICK_REFERENCE.md` | This file |

## Integration Template

```typescript
// File: app/api/features/action/route.ts

import { writeAuditLog } from "@/lib/audit/logger";

export async function POST(req: NextRequest) {
  // ... auth checks ...

  try {
    // Perform state mutation
    await db.collection("...").update({...});

    // Log it
    await writeAuditLog({
      type: "feature_action",
      adminId: auth.uid,
      adminName: auth.displayName,
      employeeId: "...",
      note: "...",
    });

    return ok({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
```

## UI Features

- **Filter Bar:** Type, Employee ID, Date Range
- **Table:** Timestamp, Type (badge), Admin, Employee, Description, Details
- **Pagination:** 50 per page with prev/next
- **Expand Rows:** See full details, changes, metadata
- **Export:** Download as CSV

## Common Usage

### Check who approved a correction
1. Go to `/admin/audit-logs`
2. Filter: Type = "correction_approved"
3. Expand row to see admin name, employee, changes

### Audit employee changes
1. Filter: Employee ID = "emp_123"
2. See all actions performed on this employee
3. Sort by timestamp

### Export monthly audit trail
1. Set date range: Apr 1 - Apr 30
2. Click "Export CSV"
3. Opens in Excel/Sheets

## Troubleshooting

**No logs showing?**
- Make sure you're logged in as admin/CEO
- Add test logs via Firestore console
- Check network tab for API errors

**Filter not working?**
- Click "Apply Filters" button
- Check for typos in employee ID
- Ensure date format is valid

**CSV not downloading?**
- Check browser popup blocker
- Try a different browser
- Make sure you have logs to export

## Security

- Only admin/CEO can view
- Session cookie required
- Logs are immutable (can't edit/delete)
- Server-side writes only

## Performance Tips

- Use date range to limit results
- Filter by type for specific actions
- Pagination shows 50 at a time
- CSV export works on filtered results

## Next Steps

1. **Integrate Logging**
   - Add `writeAuditLog()` to your endpoints
   - Start with high-impact operations
   - Use integration checklist

2. **Test**
   - View logs at `/admin/audit-logs`
   - Filter and export
   - Verify changes appear

3. **Monitor**
   - Check audit logs regularly
   - Export monthly reports
   - Watch for suspicious patterns

## Support

For detailed information:
- Read `AUDIT_LOG_VIEWER_IMPLEMENTATION.md`
- Check `AUDIT_LOGGING_INTEGRATION_CHECKLIST.md`
- Review code comments in source files

---

**Status:** Ready to use. Start integrating endpoints today!
