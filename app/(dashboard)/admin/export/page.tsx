import DataExportClient from "./DataExportClient";

export default function AdminExportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Data Export & Backup</h1>
        <p className="mt-1 text-sm text-slate-500">
          Export collections in JSON or CSV format for backup or external analysis.
        </p>
      </div>
      <DataExportClient />
    </div>
  );
}
