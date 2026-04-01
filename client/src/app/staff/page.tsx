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
import styles from "@/app/staff/page.module.css"
import { formatCurrency, formatDateOnly, formatRelativeDate } from "@/lib/admin-format"
import { canManageFinance } from "@/lib/roles"
import { staffApi } from "@/lib/staff-client"
import type { AdminUser } from "@/types/admin"
import type { StaffDashboardResponse } from "@/types/staff"

export default function StaffHomePage() {
  const { data, error, isLoading } = useAdminResource(
    () =>
      Promise.all([staffApi.dashboard(), staffApi.me()]).then(([dashboard, me]) => ({
        dashboard,
        me: me as AdminUser,
      })),
    [],
  )

  if (isLoading) {
    return (
      <DashboardPage>
        <SkeletonPageHero />
        <SkeletonMetricGrid count={5} />
        <div className={styles.splitGrid}>
          <SkeletonSurface itemCount={3} />
          <SkeletonSurface itemCount={3} />
        </div>
        <div className={styles.splitGrid}>
          <SkeletonSurface itemCount={3} showAction={false} />
          <SkeletonSurface itemCount={3} showAction={false} />
        </div>
      </DashboardPage>
    )
  }

  if (error || !data) {
    return <ErrorState title="Workspace unavailable" description={error ?? "Unable to load workspace."} />
  }

  const dashboard: StaffDashboardResponse = data.dashboard

  return (
    <DashboardPage>
      <PageHero
        eyebrow={`${data.me.role} Workspace`}
        title="Delivery summary"
        description="Review assigned bookings, projects, inbox activity, and urgent tasks from one workspace."
        action={{ label: "Open bookings", href: "/staff/bookings" }}
        secondaryAction={{ label: "Open chat", href: "/staff/chat" }}
      />

      <div className={styles.metricGrid}>
        <MetricCard label="Assigned leads" value={dashboard.summary.assignedLeads} hint="Sales and follow-up coverage." />
        <MetricCard label="Active projects" value={dashboard.summary.activeProjects} hint="Planning to event day." />
        <MetricCard label="Open tasks" value={dashboard.summary.openTasks} hint="Execution work still in motion." />
        <MetricCard label="Overdue tasks" value={dashboard.summary.overdueTasks} hint="Needs attention now." />
        <MetricCard label="Outstanding" value={formatCurrency(dashboard.summary.outstandingPayments)} hint="Pending collections on owned work." />
      </div>

      <div className={styles.splitGrid}>
        <Surface title="My bookings" description="Assigned lead work that still needs qualification or commercial movement.">
          <div className={styles.stack}>
            {dashboard.leads.length ? dashboard.leads.map((lead) => (
              <Link key={lead.id} href={`/staff/bookings/${lead.id}`} className={styles.card}>
                <div className={styles.header}>
                  <div>
                    <p className={styles.title}>{lead.eventType}</p>
                    <p className={styles.copy}>{lead.client.name ?? lead.client.phone ?? lead.client.email}</p>
                  </div>
                  <StatusBadge value={lead.status} />
                </div>
                <p className={styles.meta}>{lead.location} | {formatDateOnly(lead.eventDate)}</p>
              </Link>
            )) : <p className={styles.copy}>No bookings are assigned right now.</p>}
          </div>
        </Surface>

        <Surface title="Priority inbox" description="Recent client communication across assigned workstreams.">
          <div className={styles.stack}>
            {dashboard.inbox.length ? dashboard.inbox.map((thread) => (
              <Link key={thread.id} href={`/staff/chat?leadId=${thread.leadId}`} className={styles.card}>
                <div className={styles.header}>
                  <p className={styles.title}>{thread.title}</p>
                  {thread.unreadCount ? <StatusBadge value="NEW" /> : null}
                </div>
                <p className={styles.copy}>{thread.client.name ?? thread.client.phone ?? thread.client.email}</p>
                <p className={styles.copy}>{thread.lastMessage?.body ?? "No messages yet."}</p>
                <p className={styles.meta}>Updated {formatRelativeDate(thread.updatedAt)}</p>
              </Link>
            )) : <p className={styles.copy}>No active threads yet.</p>}
          </div>
        </Surface>
      </div>

      <div className={styles.splitGrid}>
        <Surface title="Projects in motion" description="Execution work scoped to your assignments.">
          <div className={styles.stack}>
            {dashboard.projects.length ? dashboard.projects.map((project) => (
              <Link key={project.id} href={`/staff/projects/${project.id}`} className={styles.card}>
                <div className={styles.header}>
                  <div>
                    <p className={styles.title}>{project.contract?.proposal?.title ?? "Project"}</p>
                    <p className={styles.copy}>{project.contract?.proposal?.lead?.location ?? "Location pending"}</p>
                  </div>
                  <StatusBadge value={project.status} />
                </div>
                <progress className={styles.progress} value={project.progress} max={100} />
                <p className={styles.meta}>{project.progress}% complete</p>
              </Link>
            )) : <p className={styles.copy}>No projects are assigned right now.</p>}
          </div>
        </Surface>

        <Surface title="Task radar" description="Direct assignments and execution bottlenecks.">
          <div className={styles.stack}>
            {dashboard.tasks.length ? dashboard.tasks.map((task) => (
              <div key={task.id} className={styles.card}>
                <div className={styles.header}>
                  <div>
                    <p className={styles.title}>{task.title}</p>
                    <p className={styles.copy}>{task.priority} priority</p>
                  </div>
                  <StatusBadge value={task.status} />
                </div>
                <p className={styles.meta}>Due {formatDateOnly(task.dueDate)}</p>
              </div>
            )) : <p className={styles.copy}>No tasks are assigned yet.</p>}
          </div>
        </Surface>
      </div>

      {canManageFinance(data.me.role) ? (
        <Surface title="Finance view" description="Milestones requiring action or review.">
          <div className={styles.splitGrid}>
            {dashboard.payments.length ? dashboard.payments.map((payment) => (
              <div key={payment.id} className={styles.card}>
                <div className={styles.header}>
                  <div>
                    <p className={styles.title}>{payment.type} milestone</p>
                    <p className={styles.copy}>{payment.project?.contract?.proposal?.title ?? payment.projectId}</p>
                  </div>
                  <StatusBadge value={payment.status} />
                </div>
                <p className={styles.value}>{formatCurrency(payment.amount)}</p>
              </div>
            )) : <p className={styles.copy}>No finance items are currently assigned.</p>}
          </div>
        </Surface>
      ) : null}
    </DashboardPage>
  )
}
