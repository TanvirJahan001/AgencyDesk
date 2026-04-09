import CronMonitoringDashboard from "./CronMonitoringClient";

export default function CronPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Cron Monitoring</h1>
        <p className="mt-1 text-sm text-slate-500">View scheduled job execution logs and trigger jobs manually.</p>
      </div>
      <CronMonitoringDashboard />
    </div>
  );
}
