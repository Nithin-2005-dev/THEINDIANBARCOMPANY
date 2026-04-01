"use client"

import AdminPageHeader from "@/components/admin/AdminPageHeader"
import EmptyState from "@/components/admin/EmptyState"
import Panel from "@/components/admin/Panel"
import { useAdminResource } from "@/components/admin/useAdminResource"
import { adminApi } from "@/lib/admin-client"

export default function AdminSettingsPage() {
  const { data, error, isLoading } = useAdminResource(() => adminApi.systemOverview(), [])

  if (isLoading) return <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 text-white/65">Loading system overview...</div>
  if (error || !data) return <EmptyState title="System overview unavailable" description={error ?? "Unable to load system overview."} />

  return (
    <div>
      <AdminPageHeader title="Settings & System" description="Operational observability for sessions, OTP queue pressure, and background processing health." />
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Sessions">
          <div className="space-y-2 text-sm text-white/55">
            <p>Active sessions: {data.sessions.active}</p>
            <p>Suspicious sessions: {data.sessions.suspicious}</p>
          </div>
        </Panel>
        <Panel title="OTP">
          <div className="space-y-2 text-sm text-white/55">
            <p>Pending OTP challenges: {data.otpChallenges.pending}</p>
          </div>
        </Panel>
        <Panel title="Queue Health">
          <pre className="overflow-auto rounded-[20px] bg-black/20 p-4 text-xs text-white/55">
            {JSON.stringify(data.queues, null, 2)}
          </pre>
        </Panel>
      </div>
    </div>
  )
}
