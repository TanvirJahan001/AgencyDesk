# Document Management Feature

A complete document management system for the Employee Attendance & Payroll application. Allows admins/CEOs to upload and manage employee documents (contracts, IDs, certificates, etc.) and provides employees with read-only access to their own documents.

## Overview

**Key Features:**
- Upload documents with metadata (title, category, expiry date, file URL)
- Track document status (active, expired, archived)
- Filter documents by employee, category, and status
- Automatic expiry detection and warnings
- Role-based access control (Employee/Admin/CEO)
- External file storage (metadata stored in Firestore, files in external storage)

## Architecture

### Database Schema

**Collection:** `employee_documents/{docId}`

```typescript
{
  id: string;                    // Document ID
  employeeId: string;            // Employee UID
  employeeName: string;          // Employee display name (snapshot)
  title: string;                 // Document title
  category: DocumentCategory;    // contract | id_document | certificate | tax_form | offer_letter | policy | other
  description?: string;          // Optional notes
  fileUrl: string;               // External URL to document
  fileName: string;              // Display name of file
  fileType?: string;             // MIME type (e.g., application/pdf)
  expiresAt?: string;            // ISO 8601 expiry date
  uploadedBy: string;            // Admin UID who uploaded
  uploadedByName: string;        // Admin display name
  status: DocumentStatus;        // active | expired | archived
  createdAt: string;             // ISO 8601 timestamp
  updatedAt: string;             // ISO 8601 timestamp
}
```

### Type Definitions

**File:** `types/index.ts`

New types added:
- `EmployeeDocument` — Full document interface
- `DocumentCategory` — Union of document types
- `DocumentStatus` — Document state
- `DOCUMENT_CATEGORIES` — Constant array of category options

### API Routes

#### `GET /api/documents`
Fetch documents based on role:
- **Admin/CEO:** All documents, optionally filtered by `employeeId` query param
- **Employee:** Only their own documents
- Returns: `EmployeeDocument[]` sorted by `createdAt` (descending)

#### `POST /api/documents`
Create new document (Admin/CEO only)
- **Required:** `employeeId`, `title`, `category`, `fileUrl`, `fileName`
- **Optional:** `description`, `fileType`, `expiresAt`
- Validates input length and category
- Auto-computes status based on expiry date
- Returns: Created `EmployeeDocument`

#### `PATCH /api/documents/{id}`
Update document (Admin/CEO only)
- **Optional fields:** `title`, `category`, `description`, `fileUrl`, `fileName`, `fileType`, `expiresAt`, `status`
- Auto-recalculates status from expiry date if provided
- Returns: Updated `EmployeeDocument`

#### `DELETE /api/documents/{id}`
Delete document (Admin only)
- Soft checks only (existence verification)
- Returns: `{ success: true }`

## File Structure

```
app/
├── api/documents/
│   ├── route.ts                     # GET (fetch) / POST (create)
│   └── [id]/route.ts                # PATCH (update) / DELETE (delete)
└── (dashboard)/
    ├── admin/documents/
    │   ├── page.tsx                 # Admin page (server)
    │   └── AdminDocumentsClient.tsx  # Admin UI component (client)
    ├── employee/documents/
    │   ├── page.tsx                 # Employee page (server)
    │   └── EmployeeDocumentsClient.tsx  # Employee UI component (client)
    └── ceo/documents/
        └── page.tsx                 # CEO page (server)

components/layout/
└── Sidebar.tsx                      # Updated with Document links

types/
└── index.ts                         # New types added

firestore.rules                      # New security rules added

lib/api/
├── helpers.ts                       # Uses existing helpers
└── validate.ts                      # Uses existing validation
```

## UI Components

### Admin/CEO Pages (`AdminDocumentsClient.tsx`)

**Features:**
- **Table view** showing: Employee, Title, Category, File Name (link), Expiry Date, Status, Actions
- **Search** by employee name, title, or file name
- **Category filter** dropdown
- **Employee filter** dropdown
- **Upload Document** button → Opens modal form
- **Edit/Delete buttons** for each document
- **Status badges** with color coding:
  - Green: `active`
  - Red: `expired`
  - Gray: `archived`
- **Expiry warning** icon for expired documents
- **Modal form** with:
  - Employee selector (for new uploads)
  - Title input
  - Category select
  - Description textarea
  - File URL input
  - File name input
  - File type input
  - Optional expiry date picker
- **Delete confirmation** modal with warning

**State Management:**
- Uses `useState` for documents, filters, modals, forms
- Uses `useCallback` for fetch operations
- Fetches from `/api/documents` and `/api/employees`

### Employee Page (`EmployeeDocumentsClient.tsx`)

**Features:**
- **Read-only table view** showing: Title, Category, File Name (link), Expiry Date, Status
- **Search** by title or file name
- **Category filter** dropdown
- **No edit/delete** buttons (view-only)
- **View action** link opens file in new tab
- **Status badges** with same color coding
- **Expiry warning** icon for expired documents

## Navigation

The Sidebar now includes Document links for all roles:

- **Employee:** "My Documents" (`/employee/documents`) — FolderOpen icon
- **Admin:** "Documents" (`/admin/documents`) — FolderOpen icon
- **CEO:** "Documents" (`/ceo/documents`) — FolderOpen icon

Import: `FolderOpen` from `lucide-react`

## Security

### Firestore Rules (`firestore.rules`)

```
match /employee_documents/{docId} {
  allow read: if isSignedIn() && (
    resource.data.employeeId == authUid() || isPrivileged()
  );
  allow create, update: if isPrivileged();
  allow delete: if isAdmin();
}
```

**Permissions:**
- **Read:** Signed-in users can see their own documents OR privileged users (admin/ceo) can see all
- **Create/Update:** Only privileged users (admin/ceo)
- **Delete:** Only admin

### API Validation

Uses existing helpers:
- `safeParseBody()` — Safe JSON parsing
- `getSession()` — Session verification
- `hasRole()` — Role checking
- `validateLength()` — Input length validation
- `firstError()` — Batch validation

## Usage Examples

### Upload a Document (Admin)

```typescript
const response = await fetch("/api/documents", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    employeeId: "uid123",
    title: "Bachelor's Degree Certificate",
    category: "certificate",
    description: "Computer Science - University of XYZ",
    fileUrl: "https://storage.example.com/certs/john_doe_degree.pdf",
    fileName: "john_doe_degree.pdf",
    fileType: "application/pdf",
    expiresAt: null, // No expiry for degrees
  }),
});

const { success, data } = await response.json();
```

### Update Document Status

```typescript
const response = await fetch("/api/documents/doc123", {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    status: "archived",
    title: "Updated Title",
  }),
});
```

### Fetch Employee Documents

```typescript
// For admin: filter by employeeId
const res = await fetch("/api/documents?employeeId=uid456");

// For employee: auto-filters to their own
const res = await fetch("/api/documents");

const { data: documents } = await res.json();
```

## File Storage Notes

**Important:** This system does NOT use Firebase Storage. Instead:
1. Users upload files to external storage (AWS S3, Google Cloud Storage, Cloudinary, etc.)
2. The admin provides the public URL to the uploaded file
3. Document metadata is stored in Firestore
4. The file URL is stored in the `fileUrl` field

This approach:
- Avoids Firebase Storage costs
- Allows use of dedicated file storage services
- Keeps Firestore lightweight (metadata only)
- Works with any external HTTP-accessible storage

## Implementation Notes

### Automatic Status Calculation

When creating or updating a document with an `expiresAt` date:
- If the date is in the past → status becomes `expired`
- If the date is in the future or no date → status is `active`
- Admin can manually set status to `archived` for old/inactive documents

### Employee Name Snapshot

When a document is created, the current employee's `displayName` is saved as `employeeName`. This snapshot prevents issues if the employee's name changes later.

### Upload Tracking

Each document tracks:
- `uploadedBy` (admin UID who uploaded)
- `uploadedByName` (admin name)
- `createdAt` / `updatedAt` timestamps

### External URL Validation

No URL validation is performed on the API. Ensure URLs:
- Are publicly accessible
- Point to valid files
- Are permanent (not temporary signed URLs)

## Testing Checklist

- [ ] Admin can upload document with all fields
- [ ] Admin can upload document with minimal fields (no expiry/description)
- [ ] Document status auto-sets to "expired" if expiresAt is in the past
- [ ] Admin can filter by employee, category, status
- [ ] Admin can search by employee name, title, filename
- [ ] Admin can edit document fields
- [ ] Admin can delete document
- [ ] Employee sees only own documents
- [ ] Employee cannot edit or delete documents
- [ ] Expired documents show warning icon
- [ ] File name links open in new tab
- [ ] Category badges display correctly
- [ ] Modal form validates required fields
- [ ] Delete confirmation prevents accidental deletion
- [ ] Sidebar links work for all roles

## Future Enhancements

- Direct file upload to Firebase Storage or external cloud
- Document preview/viewer
- Document expiry reminders (via notification system)
- Document versioning (track multiple versions)
- Document approval workflow
- Export documents to PDF
- Bulk upload (multiple documents at once)
- Document sharing between employees
- Document templates (e.g., standard contracts)
- Document archival rules (auto-archive after expiry)
