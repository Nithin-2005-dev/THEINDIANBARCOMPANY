"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import StatusBadge from "@/components/admin/StatusBadge"
import BookingCard from "@/components/booking-card/BookingCard"
import {
  DashboardPage,
  EmptyState,
  ErrorState,
  MetricCard,
  PageHero,
  SkeletonMetricGrid,
  SkeletonPageHero,
  SkeletonSurface,
  Surface,
} from "@/components/dashboard/DashboardPrimitives"
import PortalShell from "@/components/portal/PortalShell"
import styles from "@/components/portal/CustomerDashboardClient.module.css"
import {
  fetchPortalDashboard,
  markNotificationRead,
  PortalApiError,
} from "@/lib/client-portal"
import type { PortalDashboardResponse } from "@/types/client-portal"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export default function CustomerDashboardClient() {
  const [data, setData] = useState<PortalDashboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPortalDashboard()
      .then(setData)
      .catch((err) =>
        setError(
          err instanceof PortalApiError ? err.message : "Unable to load dashboard.",
        ),
      )
  }, [])

  const unreadNotifications = useMemo(
    () => data?.notifications.filter((item) => !item.readAt).length ?? 0,
    [data?.notifications],
  )

  const outstandingAmount = useMemo(
    () =>
      (data?.events ?? []).reduce(
        (sum, event) => sum + event.paymentSummary.outstanding,
        0,
      ),
    [data?.events],
  )

  const nextActionItems = useMemo(
    () =>
      (data?.events ?? [])
        .filter((event) => event.status !== "COMPLETED")
        .slice(0, 3),
    [data?.events],
  )

  const bookingsPreview = useMemo(
    () => (data?.events ?? []).slice(0, 4),
    [data?.events],
  )

  const recentNotifications = useMemo(
    () => (data?.notifications ?? []).slice(0, 4),
    [data?.notifications],
  )

  const outstandingItems = useMemo(
    () =>
      (data?.events ?? [])
        .filter((event) => event.paymentSummary.outstanding > 0)
        .sort(
          (left, right) =>
            right.paymentSummary.outstanding - left.paymentSummary.outstanding,
        )
        .slice(0, 4),
    [data?.events],
  )

  if (error) {
    return (
      <PortalShell>
        <ErrorState title="Dashboard unavailable" description={error} />
      </PortalShell>
    )
  }

  if (!data) {
    return (
      <PortalShell>
        <DashboardPage>
          <SkeletonPageHero />
          <SkeletonMetricGrid count={4} />
          <div className={styles.layout}>
            <SkeletonSurface itemCount={2} />
            <div className={styles.sideStack}>
              <SkeletonSurface itemCount={2} />
              <SkeletonSurface itemCount={2} showAction={false} />
            </div>
          </div>
        </DashboardPage>
      </PortalShell>
    )
  }

  return (
    <PortalShell>
      <DashboardPage>
          <PageHero
            eyebrow="Client portal"
            title="Your event operations workspace"
            description="Track active bookings, payments, approvals, and support updates from one calm, reliable dashboard."
            action={{ label: "View bookings", href: "/dashboard/bookings" }}
            secondaryAction={{ label: "Request booking", href: "/booking" }}
          />

          <div className={styles.metricGrid}>
            <MetricCard
              label="Active bookings"
              value={data.overview.activeCount}
              hint="Live event workspaces still moving."
            />
            <MetricCard
              label="Completed"
              value={data.overview.completedCount}
              hint="Past events archived in your portal."
            />
            <MetricCard
              label="Unread updates"
              value={unreadNotifications}
              hint="Approvals, reminders, and support follow-ups."
            />
            <MetricCard
              label="Outstanding"
              value={formatCurrency(outstandingAmount)}
              hint="Milestones still awaiting payment."
            />
          </div>

          <div className={styles.layout}>
            <Surface
              title="Bookings summary"
              description="Open the right event workspace quickly with progress, payment, and next-step context."
              headerAction={
                <Link href="/dashboard/bookings" className={styles.sectionLink}>
                  View all bookings
                </Link>
              }
            >
              {bookingsPreview.length ? (
                <div className={styles.bookingList}>
                  {bookingsPreview.map((event) => (
                    <BookingCard
                      key={event.id}
                      actions={[
                        { label: "View workspace", href: `/dashboard/bookings/${event.id}`, tone: "primary" },
                        { label: "Open chat", href: `/dashboard/chat?bookingId=${event.id}`, tone: "secondary" },
                      ]}
                      meta={formatDate(event.eventDate)}
                      metrics={[
                        {
                          label: "Date & location",
                          value: `${event.eventType} at ${event.location}`,
                          tone: "accent",
                        },
                        {
                          label: "Payment status",
                          value:
                            event.paymentSummary.outstanding > 0
                              ? `${formatCurrency(event.paymentSummary.outstanding)} due`
                              : "Fully paid",
                          tone: event.paymentSummary.outstanding > 0 ? "warning" : "success",
                        },
                        {
                          label: "Next action",
                          value: event.nextAction.label,
                        },
                        {
                          label: "Latest update",
                          value: event.timelinePreview[0]?.title ?? "Awaiting the next update",
                        },
                      ]}
                      progress={event.progress}
                      status={event.status}
                      subtitle={`${formatCurrency(event.paymentSummary.paid)} paid so far`}
                      title={event.title}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No bookings yet"
                  description="Request your first event to unlock bookings, payments, documents, and support in this workspace."
                  action={{ label: "Request booking", href: "/booking" }}
                />
              )}
            </Surface>

            <div className={styles.sideStack}>
              <Surface
                title="Action center"
                description="The clearest next step across your active bookings."
                headerAction={
                  <Link href="/dashboard/chat" className={styles.sectionLink}>
                    Open support chat
                  </Link>
                }
              >
                {nextActionItems.length ? (
                <div className={styles.actionList}>
                  {nextActionItems.map((event) => (
                      <BookingCard
                        key={event.id}
                        actions={[
                          {
                            label: "View booking",
                            href: event.nextAction.path.replace("/events/", "/bookings/"),
                            tone: "primary",
                          },
                          {
                            label: "Open chat",
                            href: `/dashboard/chat?bookingId=${event.id}`,
                            tone: "ghost",
                          },
                        ]}
                        meta={formatDate(event.eventDate)}
                        metrics={[
                          {
                            label: "Next action",
                            value: event.nextAction.label,
                            tone: "accent",
                          },
                          {
                            label: "Location",
                            value: event.location,
                          },
                        ]}
                        status={event.status}
                        subtitle={event.eventType}
                        title={event.title}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No urgent actions"
                    description="Everything currently looks on track. New approvals or milestones will appear here automatically."
                    action={{ label: "Request booking", href: "/booking" }}
                  />
                )}
              </Surface>

              <Surface
                title="Outstanding payments"
                description="The highest-value pending milestones across your bookings."
              >
                {outstandingItems.length ? (
                <div className={styles.actionList}>
                  {outstandingItems.map((event) => (
                      <BookingCard
                        key={event.id}
                        actions={[
                          { label: "View booking", href: `/dashboard/bookings/${event.id}`, tone: "primary" },
                          { label: "Open payments", href: `/dashboard/bookings/${event.id}`, tone: "secondary" },
                        ]}
                        meta={formatDate(event.eventDate)}
                        metrics={[
                          {
                            label: "Outstanding",
                            value: formatCurrency(event.paymentSummary.outstanding),
                            tone: "warning",
                          },
                          {
                            label: "Next action",
                            value: event.nextAction.label,
                          },
                        ]}
                        status={event.status}
                        subtitle={event.eventType}
                        title={event.title}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No outstanding payments"
                    description="All visible milestones are settled. New payment requests will appear here when they are issued."
                    action={{ label: "View bookings", href: "/dashboard/bookings" }}
                  />
                )}
              </Surface>
            </div>
          </div>

          <div className={styles.layout}>
            <Surface
              title="Recent activity"
              description="The latest approvals, reminders, and support updates from the team."
              headerAction={
                <Link href="/dashboard/notifications" className={styles.sectionLink}>
                  Notifications
                </Link>
              }
            >
              {recentNotifications.length ? (
                <div className={styles.notificationList}>
                  {recentNotifications.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      className={`${styles.notificationCard} ${!notification.readAt ? styles.noticeUnread : ""}`.trim()}
                      onClick={async () => {
                        await markNotificationRead(notification.id)
                        if (notification.actionUrl) {
                          window.location.href = notification.actionUrl
                        }
                      }}
                    >
                      <div className={styles.notificationHeader}>
                        <p className={styles.title}>{notification.title}</p>
                        {!notification.readAt ? <StatusBadge value="NEW" /> : null}
                      </div>
                      <p className={styles.copy}>{notification.body}</p>
                      <p className={styles.metaLine}>{formatDate(notification.createdAt)}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No recent activity"
                  description="Approvals, payment reminders, and planning updates will appear here as soon as your team posts them."
                  action={{ label: "Open chat", href: "/dashboard/chat" }}
                />
              )}
            </Surface>

            <Surface
              title="Upcoming milestones"
              description="The nearest confirmed events on your calendar."
              headerAction={
                <Link href="/dashboard/bookings" className={styles.sectionLink}>
                  View booking calendar
                </Link>
              }
            >
              {data.overview.upcomingEvents.length ? (
                <div className={styles.actionList}>
                  {data.overview.upcomingEvents.slice(0, 4).map((event) => (
                    <BookingCard
                      key={event.id}
                      actions={[
                        { label: "View booking", href: `/dashboard/bookings/${event.id}`, tone: "primary" },
                      ]}
                      meta={formatDate(event.eventDate)}
                      metrics={[
                        {
                          label: "Location",
                          value: event.location,
                        },
                        {
                          label: "Next action",
                          value: event.nextAction.label,
                        },
                      ]}
                      status={event.status}
                      subtitle={event.eventType}
                      title={event.title}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No upcoming milestones"
                  description="As soon as timelines are confirmed, the nearest events will surface here."
                  action={{ label: "View bookings", href: "/dashboard/bookings" }}
                />
              )}
            </Surface>
          </div>
      </DashboardPage>
    </PortalShell>
  )
}
