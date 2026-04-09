import AuditLogViewerClient from "../../admin/audit-logs/AuditLogViewerClient";

export default function CEOAuditLogsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
        <p className="mt-1 text-sm text-slate-500">
          View system-wide audit trail of all administrative actions and state mutations.
        </p>
      </div>
      <AuditLogViewerClient />
    </div>
  );
}
