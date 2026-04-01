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
import styles from "@/app/vendor/page.module.css"
import { formatCurrency, formatDateOnly } from "@/lib/admin-format"
import { vendorApi } from "@/lib/vendor-client"
import type { VendorDashboardResponse } from "@/types/vendor"

export default function VendorHomePage() {
  const { data, error, isLoading } = useAdminResource(() => vendorApi.dashboard(), [])

  if (isLoading) {
    return (
      <DashboardPage>
        <SkeletonPageHero />
        <SkeletonMetricGrid count={4} />
        <div className={styles.splitGrid}>
          <SkeletonSurface itemCount={3} />
          <div className={styles.stack}>
            <SkeletonSurface itemCount={3} />
            <SkeletonSurface itemCount={2} showAction={false} />
          </div>
        </div>
      </DashboardPage>
    )
  }

  if (error || !data) {
    return <ErrorState title="Vendor workspace unavailable" description={error ?? "Unable to load assignments."} />
  }

  const dashboard: VendorDashboardResponse = data
  const outstandingTotal = dashboard.projects.reduce(
    (sum, project) => sum + project.paymentSummary.outstanding,
    0,
  )
  const paidTotal = dashboard.projects.reduce(
    (sum, project) => sum + project.paymentSummary.paid,
    0,
  )
  const nextAssignment = dashboard.projects[0]

  return (
    <DashboardPage>
      <PageHero
        eyebrow="Vendor workspace"
        title={dashboard.vendor.name}
        description="Review active assignments, delivery expectations, payment visibility, and coordination updates from one focused workspace."
        action={
          nextAssignment
            ? { label: "Open next assignment", href: `/vendor/projects/${nextAssignment.id}` }
            : undefined
        }
      />

      <div className={styles.metricGrid}>
        <MetricCard label="Assigned events" value={dashboard.summary.assignedProjects} hint="Confirmed work in your queue." />
        <MetricCard label="Open tasks" value={dashboard.summary.openTasks} hint="Deliverables still awaiting action." />
        <MetricCard label="Completed tasks" value={dashboard.summary.completedTasks} hint="Finished execution items." />
        <MetricCard label="Outstanding value" value={formatCurrency(outstandingTotal)} hint={`${formatCurrency(paidTotal)} already paid`} />
      </div>

      <div className={styles.splitGrid}>
        <Surface title="Assignments" description="Only confirmed projects linked to your vendor account.">
          <div className={styles.stack}>
            {dashboard.projects.length ? (
              dashboard.projects.map((project) => (
                <Link key={project.id} href={`/vendor/projects/${project.id}`} className={styles.card}>
                  <div className={styles.header}>
                    <div>
                      <p className={styles.title}>{project.title}</p>
                      <p className={styles.copy}>{project.location}</p>
                    </div>
                    <StatusBadge value={project.status} />
                  </div>
                  <div className={styles.detailRow}>
                    <p className={styles.meta}>{formatDateOnly(project.eventDate)}</p>
                    <p className={styles.meta}>{project.eventType}</p>
                  </div>
                  <progress className={styles.progress} value={project.progress} max={100} />
                  <div className={styles.detailRow}>
                    <p className={styles.copy}>{project.progress}% complete</p>
                    <p className={styles.copy}>{project.openTasks} open task(s)</p>
                  </div>
                </Link>
              ))
            ) : (
              <p className={styles.copy}>No assignments are linked to this vendor account yet.</p>
            )}
          </div>
        </Surface>

        <div className={styles.stack}>
          <Surface title="Payment visibility" description="Paid and pending value across your active projects.">
            <div className={styles.stack}>
              {dashboard.projects.length ? (
                dashboard.projects.slice(0, 4).map((project) => (
                  <div key={project.id} className={styles.card}>
                    <div className={styles.header}>
                      <div>
                        <p className={styles.title}>{project.title}</p>
                        <p className={styles.copy}>{project.eventType}</p>
                      </div>
                      <p className={styles.value}>{formatCurrency(project.paymentSummary.outstanding)}</p>
                    </div>
                    <div className={styles.detailRow}>
                      <p className={styles.copy}>{formatCurrency(project.paymentSummary.paid)} paid</p>
                      <p className={styles.meta}>Pending balance</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className={styles.copy}>Payment details will appear when assignments are confirmed.</p>
              )}
            </div>
          </Surface>

          <Surface title="Notifications" description="Recent reminders and coordination updates from operations.">
            <div className={styles.stack}>
              {dashboard.notifications.length ? (
                dashboard.notifications.map((notification) => (
                  <div key={notification.id} className={styles.card}>
                    <p className={styles.title}>{notification.title}</p>
                    <p className={styles.copy}>{notification.body}</p>
                  </div>
                ))
              ) : (
                <p className={styles.copy}>No notifications right now.</p>
              )}
            </div>
          </Surface>
        </div>
      </div>
    </DashboardPage>
  )
}
