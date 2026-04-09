import ActivityFeedClient from "@/app/(dashboard)/admin/activity/ActivityFeedClient";

export default function CEOActivityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Activity Feed</h1>
        <p className="mt-1 text-sm text-slate-500">
          Real-time view of recent activities across the system. Auto-refreshes every 30 seconds.
        </p>
      </div>
      <ActivityFeedClient />
    </div>
  );
}
