"use client"

import { useDeferredValue, useMemo, useState } from "react"
import BookingCard from "@/components/booking-card/BookingCard"
import { useAdminResource } from "@/components/admin/useAdminResource"
import {
  DashboardPage,
  EmptyState,
  ErrorState,
  InlineNotice,
  MetricCard,
  PageHero,
  SkeletonMetricGrid,
  SkeletonPageHero,
  SkeletonSurface,
  Surface,
} from "@/components/dashboard/DashboardPrimitives"
import { VirtualizedList } from "@/components/dashboard/VirtualizedList"
import { useToast } from "@/components/dashboard/ToastProvider"
import { adminApi } from "@/lib/admin-client"
import { useAssistantPageState } from "@/lib/assistant-page-state"
import { formatCurrency, formatDateOnly, formatRelativeDate } from "@/lib/admin-format"
import type { LeadStatus } from "@/types/admin"
import styles from "@/app/admin/bookings/page.module.css"

const leadStatuses: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATING", "WON", "LOST"]

function formatBudgetRange(min?: number | null, max?: number | null) {
  if (!min && !max) return "TBD"
  if (min && max) return `${formatCurrency(min)} - ${formatCurrency(max)}`
  if (min) return `From ${formatCurrency(min)}`
  return `Up to ${formatCurrency(max ?? 0)}`
}

export default function AdminBookingsPage() {
  const { pushToast } = useToast()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState("")
  const [search, setSearch] = useState("")
  const [service, setService] = useState("")
  const [location, setLocation] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [sortBy, setSortBy] = useState("createdAt")
  const [sortOrder, setSortOrder] = useState("desc")
  const deferredSearch = useDeferredValue(search)
  const deferredLocation = useDeferredValue(location)

  const { data, error, isLoading, isRefreshing, reload } = useAdminResource(async () => {
    const params = new URLSearchParams({ page: String(page), limit: "24" })
    if (status) {
      params.set("status", status)
    }
    if (deferredSearch.trim()) {
      params.set("search", deferredSearch.trim())
    }
    if (deferredLocation.trim()) {
      params.set("location", deferredLocation.trim())
    }
    if (fromDate) {
      params.set("dateFrom", new Date(fromDate).toISOString())
    }
    params.set("sortBy", sortBy)
    params.set("sortOrder", sortOrder)
    return adminApi.listLeads(params)
  }, [deferredLocation, deferredSearch, fromDate, page, sortBy, sortOrder, status], {
    refreshIntervalMs: 30000,
  })

  const filtered = useMemo(() => {
    if (!data) return []

    return data.items.filter((lead) => {
      const matchesService = service ? lead.eventType === service : true
      return matchesService
    })
  }, [data, service])

  const serviceOptions = useMemo(
    () =>
      Array.from(
        new Set((data?.items ?? []).map((lead) => lead.eventType).filter(Boolean)),
      ).sort(),
    [data?.items],
  )

  const metrics = useMemo(() => {
    const totalBudget = filtered.reduce(
      (sum, lead) => sum + (lead.budgetMax ?? lead.budgetMin ?? 0),
      0,
    )

    return {
      total: filtered.length,
      newCount: filtered.filter((lead) => lead.status === "NEW").length,
      activeCount: filtered.filter((lead) =>
        ["CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATING", "WON"].includes(lead.status),
      ).length,
      budget: totalBudget,
    }
  }, [filtered])

  const activeFilterCount = useMemo(
    () => [status, search.trim(), service, location.trim(), fromDate].filter(Boolean).length,
    [fromDate, location, search, service, status],
  )

  const assistantPageState = useMemo(
    () => ({
      currentTab: "bookings",
      currentView: "admin-bookings",
      searchTerm: deferredSearch.trim() || null,
      filters: {
        status: status || null,
        service: service || null,
        location: location.trim() || null,
        fromDate: fromDate || null,
        sortBy,
        sortOrder,
      },
    }),
    [deferredSearch, fromDate, location, service, sortBy, sortOrder, status],
  )

  useAssistantPageState(assistantPageState)

  const updateStatus = async (
    leadId: string,
    currentStatus: LeadStatus,
    nextStatus: LeadStatus,
  ) => {
    if (currentStatus === nextStatus) {
      return
    }

    await adminApi.updateLeadStatus(leadId, nextStatus)
    pushToast({
      title: "Booking updated",
      description: `Status changed to ${nextStatus.replaceAll("_", " ")}.`,
      tone: "success",
      actionLabel: "Undo",
      onAction: async () => {
        await adminApi.updateLeadStatus(leadId, currentStatus)
        pushToast({
          title: "Booking restored",
          description: `Status moved back to ${currentStatus.replaceAll("_", " ")}.`,
          tone: "success",
        })
        await reload()
      },
    })
    await reload()
  }

  if (isLoading) {
    return (
      <DashboardPage>
        <SkeletonPageHero />
        <SkeletonMetricGrid count={4} />
        <SkeletonSurface itemCount={4} />
      </DashboardPage>
    )
  }

  if (!data) {
    return (
      <ErrorState
        title="Bookings unavailable"
        description={error ?? "Unable to load booking records."}
      />
    )
  }

  return (
      <DashboardPage>
      <PageHero
        eyebrow="Bookings"
        title="Qualify, route, and advance every inbound booking from one queue."
        description="Filter by stage, event type, and date while keeping budget, client details, and recent activity visible for fast operations review."
        action={{ label: "Create booking", href: "/admin/bookings/new" }}
        secondaryAction={{ label: "Open pipeline", href: "/admin/pipeline" }}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Visible Bookings" value={metrics.total} hint="Current filtered result set." />
        <MetricCard label="New Requests" value={metrics.newCount} hint="Fresh inbound leads." />
        <MetricCard label="Active Pipeline" value={metrics.activeCount} hint="Contacted, qualified, proposal sent, negotiating, and won." />
        <MetricCard label="Visible Budget" value={formatCurrency(metrics.budget)} hint="Aggregate booking value." />
      </div>

      {error ? (
        <InlineNotice
          tone="warning"
          title="Showing the last successful booking data"
          description={`${error} We’ll keep refreshing in the background so you can continue working without losing context.`}
        />
      ) : null}

      <Surface
        title="Booking Queue"
        description="Bookings are created from public submissions and remain editable here until they move into later lifecycle stages."
        headerAction={
          <div className={styles.headerAction}>
            {activeFilterCount ? (
              <button
                type="button"
                className={`${styles.secondaryButton} inline-flex min-h-11 items-center rounded-[16px] px-4 text-sm`}
                onClick={() => {
                  setPage(1)
                  setStatus("")
                  setSearch("")
                  setService("")
                  setLocation("")
                  setFromDate("")
                  setSortBy("createdAt")
                  setSortOrder("desc")
                }}
              >
                Clear filters
              </button>
            ) : null}
            <div className={styles.dataPill}>
              {isRefreshing ? "Refreshing" : `${activeFilterCount || "No"} active filters`}
            </div>
          </div>
        }
      >
        <div className={`${styles.filterGrid} lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]`}>
          <label className={styles.control}>
            <input
              value={search}
              onChange={(event) => {
                setPage(1)
                setSearch(event.target.value)
              }}
              placeholder="Search by event, location, or client"
            />
          </label>
          <select
            className={styles.control}
            value={service}
            onChange={(event) => setService(event.target.value)}
          >
            <option value="">All services</option>
            {serviceOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <input
            value={location}
            onChange={(event) => {
              setPage(1)
              setLocation(event.target.value)
            }}
            placeholder="Location"
            className={styles.control}
          />
          <select
            className={styles.control}
            value={status}
            onChange={(event) => {
              setPage(1)
              setStatus(event.target.value)
            }}
          >
            <option value="">All statuses</option>
            {leadStatuses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={fromDate}
            onChange={(event) => {
              setPage(1)
              setFromDate(event.target.value)
            }}
            className={styles.control}
          />
          <select
            value={`${sortBy}:${sortOrder}`}
            onChange={(event) => {
              const [nextSortBy, nextSortOrder] = event.target.value.split(":")
              setPage(1)
              setSortBy(nextSortBy)
              setSortOrder(nextSortOrder)
            }}
            className={styles.control}
          >
            <option value="createdAt:desc">Newest first</option>
            <option value="eventDate:asc">Event date ascending</option>
            <option value="eventDate:desc">Event date descending</option>
            <option value="budgetMax:desc">Highest budget</option>
            <option value="location:asc">Location A-Z</option>
          </select>
        </div>

        <div className="mt-6">
          {filtered.length ? (
            <VirtualizedList
              items={filtered}
              itemHeight={300}
              height={Math.min(980, Math.max(380, filtered.length * 300))}
              overscan={3}
              contentClassName={styles.listContent}
              getKey={(lead) => lead.id}
              ariaLabel="Booking queue"
              renderItem={(lead) => (
                <BookingCard
                  actions={[
                    { label: "Open booking", href: `/admin/bookings/${lead.id}`, tone: "primary" },
                    { label: "Open chat", href: `/admin/chat?leadId=${lead.id}`, tone: "secondary" },
                  ]}
                  footer={
                    <div className={styles.cardFooter}>
                      <label className={styles.statusField}>
                        <span className={styles.statusLabel}>Update status</span>
                        <select
                          className={styles.control}
                          value={lead.status}
                          onChange={(event) =>
                            void updateStatus(
                              lead.id,
                              lead.status,
                              event.target.value as LeadStatus,
                            )
                          }
                        >
                          {leadStatuses.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </label>
                      {lead.notes ? (
                        <p className={styles.noteText}>{lead.notes}</p>
                      ) : null}
                    </div>
                  }
                  meta={`Event date ${formatDateOnly(lead.eventDate)} | Added ${formatRelativeDate(lead.createdAt)}`}
                  metrics={[
                    {
                      label: "Client",
                      value: lead.client.name ?? lead.client.phone ?? lead.client.email ?? "Unassigned client",
                      tone: "accent",
                    },
                    {
                      label: "Location",
                      value: lead.location,
                    },
                    {
                      label: "Guests",
                      value: lead.guestCount ? String(lead.guestCount) : "TBD",
                    },
                    {
                      label: "Budget",
                      value: formatBudgetRange(lead.budgetMin, lead.budgetMax),
                      tone: lead.budgetMax || lead.budgetMin ? "success" : "warning",
                    },
                  ]}
                  status={lead.status}
                  subtitle="Inbound booking request"
                  title={lead.eventType}
                />
              )}
            />
          ) : (
            <EmptyState
              title="No bookings match this view"
              description="Try clearing a filter or wait for the next booking to enter the queue."
            />
          )}
        </div>

        <div className={styles.pagination}>
          <p>
            Showing {filtered.length} of {data.meta.total} bookings
          </p>
          <div className={styles.paginationControls}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className={`${styles.secondaryButton} inline-flex min-h-10 items-center rounded-full px-4 text-sm`}
            >
              Previous
            </button>
            <span>Page {data.meta.page}</span>
            <button
              type="button"
              disabled={page * data.meta.limit >= data.meta.total}
              onClick={() => setPage((current) => current + 1)}
              className={`${styles.secondaryButton} inline-flex min-h-10 items-center rounded-full px-4 text-sm`}
            >
              Next
            </button>
          </div>
        </div>
      </Surface>
      </DashboardPage>
  )
}
