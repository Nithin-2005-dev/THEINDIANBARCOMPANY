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
import { formatCurrency, formatDateOnly, formatRelativeDate } from "@/lib/admin-format"
import { staffApi } from "@/lib/staff-client"
import type { LeadStatus } from "@/types/admin"
import styles from "@/app/staff/bookings/page.module.css"

const leadStatuses: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATING", "WON", "LOST"]

function formatBudgetRange(min?: number | null, max?: number | null) {
  if (!min && !max) return "TBD"
  if (min && max) return `${formatCurrency(min)} - ${formatCurrency(max)}`
  if (min) return `From ${formatCurrency(min)}`
  return `Up to ${formatCurrency(max ?? 0)}`
}

export default function StaffBookingsPage() {
  const { pushToast } = useToast()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState("")
  const [search, setSearch] = useState("")
  const [location, setLocation] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [sortBy, setSortBy] = useState("eventDate")
  const [sortOrder, setSortOrder] = useState("asc")
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
    return staffApi.listLeads(params)
  }, [deferredLocation, deferredSearch, fromDate, page, sortBy, sortOrder, status], {
    refreshIntervalMs: 30000,
  })

  const filtered = useMemo(() => {
    if (!data) return []
    const query = search.trim().toLowerCase()

    return data.items.filter((lead) => {
      return !query
        ? true
        : [lead.eventType, lead.location, lead.client.name ?? "", lead.client.phone ?? "", lead.client.email ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(query)
    })
  }, [data, search])

  const summary = useMemo(
    () => ({
      total: filtered.length,
      newCount: filtered.filter((lead) => lead.status === "NEW").length,
      liveCount: filtered.filter((lead) =>
        ["CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATING", "WON"].includes(lead.status),
      ).length,
      visibleBudget: filtered.reduce(
        (sum, lead) => sum + (lead.budgetMax ?? lead.budgetMin ?? 0),
        0,
      ),
    }),
    [filtered],
  )

  const activeFilterCount = useMemo(
    () => [status, search.trim(), location.trim(), fromDate].filter(Boolean).length,
    [fromDate, location, search, status],
  )

  const updateStatus = async (
    leadId: string,
    currentStatus: LeadStatus,
    nextStatus: LeadStatus,
  ) => {
    if (currentStatus === nextStatus) {
      return
    }

    await staffApi.updateLeadStatus(leadId, nextStatus)
    pushToast({
      title: "Booking updated",
      description: `Status changed to ${nextStatus.replaceAll("_", " ")}.`,
      tone: "success",
      actionLabel: "Undo",
      onAction: async () => {
        await staffApi.updateLeadStatus(leadId, currentStatus)
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
        description={error ?? "Unable to load assigned bookings."}
      />
    )
  }

  return (
      <DashboardPage>
      <PageHero
        eyebrow="Bookings"
        title="Assigned booking queue for follow-up, qualification, and handoff."
        description="Review owned bookings, update statuses, and open the detailed workspace for proposals, notes, timeline activity, and client communication."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Visible Bookings" value={summary.total} hint="Current filtered result set." />
        <MetricCard label="New Requests" value={summary.newCount} hint="Fresh inbound requests." />
        <MetricCard label="In Motion" value={summary.liveCount} hint="Contacted, qualified, proposal sent, negotiating, and won." />
        <MetricCard label="Visible Budget" value={formatCurrency(summary.visibleBudget)} hint="Aggregate booking value." />
      </div>

      {error ? (
        <InlineNotice
          tone="warning"
          title="Showing the last successful assigned queue"
          description={`${error} Background refresh will keep trying so you can continue updating bookings without losing your place.`}
        />
      ) : null}

      <Surface
        title="Assigned Queue"
        description="Bookings assigned to your staff account appear here first."
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
                  setLocation("")
                  setFromDate("")
                  setSortBy("eventDate")
                  setSortOrder("asc")
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
        <div className={`${styles.filterGrid} lg:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))]`}>
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
            <option value="eventDate:asc">Upcoming first</option>
            <option value="createdAt:desc">Newest first</option>
            <option value="status:asc">Status</option>
            <option value="budgetMax:desc">Highest budget</option>
          </select>
        </div>

        <div className="mt-6">
          {filtered.length ? (
            <VirtualizedList
              items={filtered}
              itemHeight={280}
              height={Math.min(960, Math.max(360, filtered.length * 280))}
              overscan={3}
              contentClassName={styles.listContent}
              getKey={(lead) => lead.id}
              ariaLabel="Assigned booking queue"
              renderItem={(lead) => (
                <BookingCard
                  actions={[
                    { label: "Open booking", href: `/staff/bookings/${lead.id}`, tone: "primary" },
                    { label: "Open chat", href: `/staff/chat?leadId=${lead.id}`, tone: "secondary" },
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
                    </div>
                  }
                  meta={`Event date ${formatDateOnly(lead.eventDate)} | Added ${formatRelativeDate(lead.createdAt)}`}
                  metrics={[
                    {
                      label: "Client",
                      value: lead.client.name ?? lead.client.phone ?? lead.client.email ?? "Assigned booking",
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
                  subtitle="Assigned booking workspace"
                  title={lead.eventType}
                />
              )}
            />
          ) : (
            <EmptyState
              title="No assigned bookings match this view"
              description="Adjust the filters or wait for the next booking to be routed to your queue."
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
