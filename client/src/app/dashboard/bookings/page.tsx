"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import BookingCard from "@/components/booking-card/BookingCard"
import {
  DashboardButton,
  DashboardPage,
  DashboardSearchField,
  EmptyState,
  ErrorState,
  InlineNotice,
  MetricCard,
  SkeletonMetricGrid,
  SkeletonSurface,
  Surface,
} from "@/components/dashboard/DashboardPrimitives"
import PortalShell from "@/components/portal/PortalShell"
import styles from "@/app/dashboard/bookings/bookings.module.css"
import { useAssistantPageState } from "@/lib/assistant-page-state"
import { fetchPortalDashboard, PortalApiError } from "@/lib/client-portal"
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

export default function ClientBookingsPage() {
  const [data, setData] = useState<PortalDashboardResponse | null>(null)
  const [status, setStatus] = useState("")
  const [search, setSearch] = useState("")
  const [service, setService] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const hasLoadedRef = useRef(false)

  const loadDashboard = useCallback(async (background = false) => {
    if (background && hasLoadedRef.current) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    try {
      const nextData = await fetchPortalDashboard()
      setData(nextData)
      setError(null)
      hasLoadedRef.current = true
    } catch (err) {
      setError(err instanceof PortalApiError ? err.message : "Unable to load bookings.")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadDashboard(true)
    }, 30000)

    return () => window.clearInterval(intervalId)
  }, [loadDashboard])

  const events = useMemo(() => data?.events ?? [], [data?.events])
  const serviceOptions = useMemo(
    () => Array.from(new Set(events.map((event) => event.eventType))).sort(),
    [events],
  )

  const filtered = useMemo(() => {
    return events.filter((event) => {
      const matchesSearch = [event.title, event.eventType, event.location]
        .join(" ")
        .toLowerCase()
        .includes(search.trim().toLowerCase())
      const matchesStatus = status ? event.status === status : true
      const matchesService = service ? event.eventType === service : true
      const matchesFromDate = fromDate
        ? new Date(event.eventDate) >= new Date(fromDate)
        : true
      return matchesSearch && matchesStatus && matchesService && matchesFromDate
    })
  }, [events, fromDate, search, service, status])

  const metrics = useMemo(
    () => ({
      visible: filtered.length,
      active: filtered.filter((event) => event.status !== "COMPLETED").length,
      completed: filtered.filter((event) => event.status === "COMPLETED").length,
      outstanding: filtered.reduce((sum, event) => sum + event.paymentSummary.outstanding, 0),
    }),
    [filtered],
  )

  const hasFilters = Boolean(search || service || status || fromDate)

  const assistantPageState = useMemo(
    () => ({
      currentTab: "bookings",
      currentView: "client-bookings",
      searchTerm: search.trim() || null,
      filters: {
        status: status || null,
        service: service || null,
        fromDate: fromDate || null,
      },
    }),
    [fromDate, search, service, status],
  )

  useAssistantPageState(assistantPageState)

  function clearFilters() {
    setSearch("")
    setService("")
    setStatus("")
    setFromDate("")
  }

  if (!data && error) {
    return (
      <PortalShell bookingTheme={{}}>
        <ErrorState title="Bookings unavailable" description={error} />
      </PortalShell>
    )
  }

  if (isLoading || !data) {
    return (
      <PortalShell bookingTheme={{}}>
        <DashboardPage>
          <SkeletonMetricGrid count={4} />
          <SkeletonSurface itemCount={4} />
        </DashboardPage>
      </PortalShell>
    )
  }

  return (
    <PortalShell bookingTheme={{}}>
        <DashboardPage>
        <div className={styles.metricGrid}>
          <MetricCard label="Visible bookings" value={metrics.visible} hint="Current filtered result set." />
          <MetricCard label="Active" value={metrics.active} hint="Events still in progress." />
          <MetricCard label="Completed" value={metrics.completed} hint="Finished event delivery." />
          <MetricCard label="Outstanding" value={formatCurrency(metrics.outstanding)} hint="Remaining amount still due." />
        </div>

        {error ? (
          <InlineNotice
            tone="warning"
            title="Showing the last successful bookings view"
            description={`${error} Your current booking list is still usable while we reconnect in the background.`}
          />
        ) : null}

        <Surface
          title="Booking index"
          description="Search, filter, and open the right event workspace with payment and progress context in one place."
          headerAction={
            <div className={styles.toolbar}>
              {isRefreshing ? <span className={styles.meta}>Syncing</span> : null}
              <Link href="/dashboard/chat" className={styles.toolbarLink}>
                Open support chat
              </Link>
            </div>
          }
        >
          <div className={styles.filters}>
            <DashboardSearchField
              value={search}
              onChange={setSearch}
              placeholder="Search bookings"
            />
            <select
              value={service}
              onChange={(event) => setService(event.target.value)}
              className={styles.select}
            >
              <option value="">All services</option>
              {serviceOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className={styles.select}
            >
              <option value="">All statuses</option>
              {Array.from(new Set(events.map((event) => event.status))).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className={styles.dateInput}
            />
          </div>

          <div className={styles.resultsHeader}>
            <p className={styles.resultsSummary}>
              {filtered.length} booking{filtered.length === 1 ? "" : "s"} shown
            </p>
            {hasFilters ? (
              <DashboardButton
                tone="ghost"
                className={styles.clearButton}
                onClick={clearFilters}
              >
                Clear filters
              </DashboardButton>
            ) : null}
          </div>

          <div className={styles.results}>
            {filtered.length ? (
              filtered.map((event) => (
                <BookingCard
                  key={event.id}
                  actions={[
                    { label: "View workspace", href: `/dashboard/bookings/${event.id}`, tone: "primary" },
                    { label: "Open chat", href: `/dashboard/chat?bookingId=${event.id}`, tone: "secondary" },
                    ...(event.paymentSummary.outstanding > 0
                      ? [{ label: "Pay milestone", href: `/dashboard/bookings/${event.id}`, tone: "ghost" as const }]
                      : []),
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
                      label: "Coordinator",
                      value: event.coordinator?.name ?? "Assigning shortly",
                    },
                    {
                      label: "Next action",
                      value: event.nextAction.label,
                    },
                  ]}
                  progress={event.progress}
                  status={event.status}
                  subtitle={`${formatCurrency(event.paymentSummary.paid)} paid so far`}
                  title={event.title}
                />
              ))
            ) : (
              <EmptyState
                title="No bookings match these filters"
                description="Clear a filter to bring your events back into view."
                action={{ label: "Clear filters", onClick: clearFilters }}
              />
            )}
          </div>
        </Surface>
        </DashboardPage>
    </PortalShell>
  )
}
