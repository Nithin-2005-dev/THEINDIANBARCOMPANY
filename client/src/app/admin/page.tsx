"use client"

import Link from "next/link"
import StatusBadge from "@/components/admin/StatusBadge"
import { useAdminResource } from "@/components/admin/useAdminResource"
import {
  DashboardPage,
  ErrorState,
  MetricCard,
  PageHero,
  SkeletonMetricGrid,
  SkeletonPageHero,
  SkeletonSurface,
  Surface,
} from "@/components/dashboard/DashboardPrimitives"
import styles from "@/app/admin/page.module.css"
import { adminApi } from "@/lib/admin-client"
import {
  formatCurrency,
  formatDate,
  formatRelativeDate,
} from "@/lib/admin-format"

export default function AdminDashboardPage() {
  const { data, error, isLoading } = useAdminResource(async () => {
    const [analytics, pipeline, system] = await Promise.all([
      adminApi.analytics(),
      adminApi.pipeline(),
      adminApi.systemOverview(),
    ])
    return { analytics, pipeline, system }
  }, [])

  if (isLoading) {
    return (
      <DashboardPage>
        <SkeletonPageHero />
        <SkeletonMetricGrid count={5} />
        <div className={styles.splitGrid}>
          <SkeletonSurface itemCount={4} />
          <SkeletonSurface itemCount={3} />
        </div>
        <div className={styles.splitGrid}>
          <SkeletonSurface itemCount={4} showAction={false} />
          <SkeletonSurface itemCount={4} showAction={false} />
        </div>
        <div className={styles.splitGrid}>
          <SkeletonSurface itemCount={3} />
          <SkeletonSurface itemCount={4} showAction={false} />
        </div>
      </DashboardPage>
    )
  }

  if (error || !data) {
    return <ErrorState title="Dashboard unavailable" description={error ?? "Unable to load dashboard data."} />
  }

  const { analytics, pipeline, system } = data
  const upcomingEvents = pipeline.filter((lead) => {
    const eventDate = new Date(lead.eventDate)
    const max = new Date()
    max.setDate(max.getDate() + 7)
    return eventDate >= new Date() && eventDate <= max
  })

  const queueAlerts =
    (system.pendingAlerts?.overdueTasks ?? 0) +
    (system.pendingAlerts?.overduePayments ?? 0)

  return (
    <DashboardPage>
      <PageHero
        eyebrow="Admin Command"
        title="Operational summary"
        description="Track revenue, pipeline, delivery pressure, and system health without leaving the command center."
        action={{ label: "Open bookings", href: "/admin/bookings" }}
        secondaryAction={{ label: "Open chat", href: "/admin/chat" }}
      />

      <div className={styles.metricGrid}>
        <MetricCard label="Revenue paid" value={formatCurrency(analytics.totals.revenuePaid)} hint="Captured through milestone payments." />
        <MetricCard label="Conversion rate" value={`${analytics.funnel?.conversionRate ?? 0}%`} hint="Lead to active project." emphasis={`${analytics.funnel?.signedContracts ?? 0} signed`} />
        <MetricCard label="Overdue payments" value={analytics.overduePayments?.count ?? 0} hint={formatCurrency(analytics.overduePayments?.amount ?? 0)} />
        <MetricCard label="Upcoming events" value={analytics.upcomingWorkload?.next7Days ?? 0} hint="Scheduled in the next seven days." />
        <MetricCard label="Queue alerts" value={queueAlerts} hint="Tasks and payments requiring action." />
      </div>

      <div className={styles.splitGrid}>
        <Surface
          title="Revenue trend"
          description="Recent paid revenue across the latest reporting periods."
          className={styles.scrollSurface}
        >
          <div className={styles.stack}>
            {analytics.revenueByPeriod?.length ? analytics.revenueByPeriod.map((item) => (
              <div key={item.period} className={styles.itemCard}>
                <div className={styles.itemHeader}>
                  <div>
                    <p className={styles.title}>{item.period}</p>
                    <p className={styles.copy}>Revenue collected</p>
                  </div>
                  <p className={styles.value}>{formatCurrency(item.paid)}</p>
                </div>
              </div>
            )) : <p className={styles.copy}>Revenue trend data will appear here.</p>}
          </div>
        </Surface>

        <Surface
          title="System health"
          description="Auth, queue, and alert visibility for operations support."
          className={styles.scrollSurface}
        >
          <div className={styles.stack}>
            <div className={styles.itemCard}><p className={styles.label}>Sessions</p><p className={styles.value}>{system.sessions.active}</p><p className={styles.copy}>{system.sessions.suspicious} suspicious session(s)</p></div>
            <div className={styles.itemCard}><p className={styles.label}>OTP challenges</p><p className={styles.value}>{system.otpChallenges.pending}</p><p className={styles.copy}>Pending verification attempts.</p></div>
            <div className={styles.itemCard}><p className={styles.label}>Alert counters</p><p className={styles.copy}>Unassigned projects: {system.pendingAlerts?.unassignedProjects ?? 0}</p><p className={styles.copy}>Overdue tasks: {system.pendingAlerts?.overdueTasks ?? 0}</p><p className={styles.copy}>Overdue payments: {system.pendingAlerts?.overduePayments ?? 0}</p></div>
          </div>
        </Surface>
      </div>

      <div className={styles.splitGrid}>
        <Surface
          title="Pipeline snapshot"
          description="Commercial movement and source quality."
          className={styles.pipelineSurface}
        >
          <div className={styles.pipelineBody}>
            <div className={styles.cardGrid}>
              <div className={styles.itemCardCompact}><p className={styles.label}>Leads</p><p className={styles.value}>{analytics.funnel?.leads ?? 0}</p></div>
              <div className={styles.itemCardCompact}><p className={styles.label}>Accepted proposals</p><p className={styles.value}>{analytics.funnel?.proposalsAccepted ?? 0}</p></div>
              <div className={styles.itemCardCompact}><p className={styles.label}>Signed contracts</p><p className={styles.value}>{analytics.funnel?.signedContracts ?? 0}</p></div>
              <div className={styles.itemCardCompact}><p className={styles.label}>Completion rate</p><p className={styles.value}>{analytics.completionMetrics?.completionRate ?? 0}%</p></div>
            </div>
            <div className={styles.sourceList}>
              {analytics.sourceTracking?.length ? analytics.sourceTracking.map((item) => (
                <div key={item.source} className={styles.sourceItem}>
                  <span className={styles.sourceName}>{item.source}</span>
                  <span className={styles.sourceCount}>{item.count}</span>
                </div>
              )) : <p className={styles.copy}>Lead source tracking will appear here.</p>}
            </div>
          </div>
        </Surface>

        <Surface
          title="Team capacity"
          description="Staff and vendor workload across active execution."
          className={styles.scrollSurface}
        >
          <div className={styles.stack}>
            {analytics.staffPerformance?.slice(0, 4).map((member) => (
              <div key={member.id} className={styles.itemCard}>
                <div className={styles.itemHeader}>
                  <div>
                    <p className={styles.title}>{member.name ?? member.id}</p>
                    <p className={styles.copy}>{member.role}</p>
                  </div>
                  <p className={styles.meta}>{member.openTasks} open | {member.completedTasks} done</p>
                </div>
              </div>
            ))}
            {analytics.vendorPerformance?.slice(0, 3).map((vendor) => (
              <div key={vendor.id} className={styles.itemCard}>
                <div className={styles.itemHeader}>
                  <div>
                    <p className={styles.title}>{vendor.name}</p>
                    <p className={styles.copy}>{vendor.serviceType}</p>
                  </div>
                  <p className={styles.meta}>{vendor.activeProjects} active project(s)</p>
                </div>
              </div>
            ))}
          </div>
        </Surface>
      </div>

      {analytics.assistant ? (
        <Surface
          title="Beer assistant"
          description="Dedicated analytics now live on the assistant page so this overview can stay lean."
          className={styles.scrollSurface}
        >
          <Link href="/admin/assistant" className={styles.itemCard}>
            <div className={styles.itemHeader}>
              <div>
                <p className={styles.title}>Open assistant analytics</p>
                <p className={styles.copy}>
                  Review trends, fallback rate, role filters, page usage, escalation triggers, and shortcut performance in one dedicated screen.
                </p>
              </div>
              <p className={styles.meta}>Dedicated view</p>
            </div>
          </Link>
        </Surface>
      ) : null}

      <div className={styles.splitGrid}>
        <Surface
          title="Upcoming event window"
          description="Bookings landing within the next seven days."
          className={styles.scrollSurface}
        >
          <div className={styles.stack}>
            {upcomingEvents.length ? upcomingEvents.slice(0, 6).map((lead) => (
              <Link key={lead.id} href={`/admin/bookings/${lead.id}`} className={styles.itemCard}>
                <div className={styles.itemHeader}>
                  <div>
                    <p className={styles.title}>{lead.eventType}</p>
                    <p className={styles.copy}>{lead.location}</p>
                  </div>
                  <StatusBadge value={lead.status} />
                </div>
                <p className={styles.meta}>{formatDate(lead.eventDate)}</p>
              </Link>
            )) : <p className={styles.copy}>No events are scheduled in the next seven days.</p>}
          </div>
        </Surface>

        <Surface
          title="Recent sessions"
          description="Latest active sessions for audit and support awareness."
          className={styles.scrollSurface}
        >
          <div className={styles.stack}>
            {system.sessions.records?.length ? system.sessions.records.map((session) => (
              <div key={session.id} className={styles.itemCard}>
                <p className={styles.title}>{session.user?.name ?? session.user?.email ?? session.user?.phone ?? session.id}</p>
                <p className={styles.copy}>{session.user?.role ?? "Unknown role"}</p>
                <p className={styles.meta}>Seen {formatRelativeDate(session.lastSeenAt)}</p>
              </div>
            )) : <p className={styles.copy}>No active session records were returned.</p>}
          </div>
        </Surface>
      </div>
    </DashboardPage>
  )
}
