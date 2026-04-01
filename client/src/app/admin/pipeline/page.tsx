"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react"
import EmptyState from "@/components/admin/EmptyState"
import { useAdminResource } from "@/components/admin/useAdminResource"
import {
  DashboardPage,
  StatusIndicator,
} from "@/components/dashboard/DashboardPrimitives"
import { useToast } from "@/components/dashboard/ToastProvider"
import {
  ArrowUpRightIcon,
  AttachmentIcon,
  SearchIcon,
  TimelineIcon,
  UpdatesIcon,
} from "@/components/dashboard/icons"
import { adminApi } from "@/lib/admin-client"
import {
  formatCurrency,
  formatDateOnly,
  formatRelativeDate,
} from "@/lib/admin-format"
import type { AdminUser, Lead, LeadStatus, StaffAssignment } from "@/types/admin"
import styles from "./page.module.css"

type SavedViewId = "all" | "mine" | "this-month" | "at-risk"
type DateFilterId = "all" | "next-30" | "this-month" | "overdue"
type SizeFilterId = "all" | "under-1l" | "1l-3l" | "3l-plus"
type TagFilterId = "all" | "high-value" | "proposal-live" | "stale" | "unassigned"

const columns: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "NEGOTIATING",
  "WON",
  "LOST",
]

const openStatuses = new Set<LeadStatus>([
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "NEGOTIATING",
])

const laneLabels: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  PROPOSAL_SENT: "Proposal Sent",
  NEGOTIATING: "Negotiating",
  WON: "Won",
  LOST: "Lost",
}

const laneDescriptions: Record<LeadStatus, string> = {
  NEW: "Fresh demand waiting for first response.",
  CONTACTED: "Active outreach and context gathering.",
  QUALIFIED: "Fit, budget, and scope are validated.",
  PROPOSAL_SENT: "Commercials are live with the client.",
  NEGOTIATING: "Pricing or scope alignment is in motion.",
  WON: "Closed successfully and ready for handoff.",
  LOST: "Archived opportunities kept for reference.",
}

const laneColorClassName: Record<LeadStatus, string> = {
  NEW: styles.laneNew,
  CONTACTED: styles.laneContacted,
  QUALIFIED: styles.laneQualified,
  PROPOSAL_SENT: styles.laneProposalSent,
  NEGOTIATING: styles.laneNegotiating,
  WON: styles.laneWon,
  LOST: styles.laneLost,
}

const savedViews: Array<{ id: SavedViewId; label: string }> = [
  { id: "all", label: "All Deals" },
  { id: "mine", label: "My Deals" },
  { id: "this-month", label: "This Month" },
  { id: "at-risk", label: "At Risk" },
]

const dayInMs = 1000 * 60 * 60 * 24

function getLeadValue(lead: Lead) {
  return lead.budgetMax ?? lead.budgetMin ?? 0
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: value >= 100000 ? 1 : 0,
  }).format(value)
}

function formatBudgetLabel(lead: Lead) {
  if (lead.budgetMin === undefined || lead.budgetMin === null) {
    return lead.budgetMax === undefined || lead.budgetMax === null
      ? "Budget TBD"
      : `Up to ${formatCurrency(lead.budgetMax)}`
  }

  if (lead.budgetMax === undefined || lead.budgetMax === null || lead.budgetMin === lead.budgetMax) {
    return formatCurrency(lead.budgetMin)
  }

  return `${formatCurrency(lead.budgetMin)} - ${formatCurrency(lead.budgetMax)}`
}

function getClientLabel(client?: AdminUser | null) {
  return (
    client?.name?.trim()
    || client?.email?.trim()
    || client?.phone?.trim()
    || "Client pending"
  )
}

function getAvatarLabel(value: string) {
  const source = value.trim()
  if (!source) return "?"
  const [first, second] = source.split(/\s+/)
  const initials = `${first?.[0] ?? ""}${second?.[0] ?? first?.[1] ?? ""}`.trim()
  return initials.slice(0, 2).toUpperCase() || source.slice(0, 2).toUpperCase()
}

function getDaysUntil(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY
  return Math.ceil((new Date(value).getTime() - Date.now()) / dayInMs)
}

function getDaysSince(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY
  return Math.floor((Date.now() - new Date(value).getTime()) / dayInMs)
}

function isThisMonth(value?: string | null) {
  if (!value) return false
  const date = new Date(value)
  const now = new Date()
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
}

function isNext30Days(value?: string | null) {
  const daysUntil = getDaysUntil(value)
  return daysUntil >= 0 && daysUntil <= 30
}

function getPrimaryOwner(lead: Lead) {
  return (
    lead.assignments?.find(
      (assignment) => assignment.isActive && assignment.role === "PRIMARY",
    )
    ?? lead.assignments?.find((assignment) => assignment.isActive)
    ?? null
  )
}

function getOwnerLabel(assignment?: StaffAssignment | null) {
  return (
    assignment?.user.name?.trim()
    || assignment?.user.email?.trim()
    || assignment?.user.phone?.trim()
    || "Unassigned"
  )
}

function isOpenLead(lead: Lead) {
  return openStatuses.has(lead.status)
}

function isStaleLead(lead: Lead) {
  return isOpenLead(lead) && getDaysSince(lead.updatedAt) >= 6
}

function isRecentLead(lead: Lead) {
  return getDaysSince(lead.updatedAt) <= 1
}

function isProposalLive(lead: Lead) {
  return lead.status === "PROPOSAL_SENT" || (lead.proposals?.length ?? 0) > 0
}

function isAtRiskLead(lead: Lead) {
  if (!isOpenLead(lead)) return false

  const noOwner = !getPrimaryOwner(lead)
  const stale = isStaleLead(lead)
  const closeToEvent = getDaysUntil(lead.eventDate) <= 5

  return stale || closeToEvent || (lead.status !== "NEW" && noOwner)
}

function getPriorityLabel(lead: Lead) {
  const value = getLeadValue(lead)
  const daysUntil = getDaysUntil(lead.eventDate)

  if (value >= 300000 || daysUntil <= 7) return "High"
  if (value >= 100000 || daysUntil <= 21) return "Medium"
  return "Low"
}

function getPriorityTone(lead: Lead) {
  const priority = getPriorityLabel(lead)
  if (priority === "High") return "critical"
  if (priority === "Medium") return "warning"
  return "neutral"
}

function getFreshnessLabel(lead: Lead) {
  const daysSince = getDaysSince(lead.updatedAt)

  if (daysSince <= 1) return "Updated today"
  if (daysSince <= 3) return `${daysSince}d fresh`
  if (daysSince <= 6) return `${daysSince}d idle`
  return `${daysSince}d stale`
}

function getFreshnessTone(lead: Lead) {
  if (isRecentLead(lead)) return "fresh"
  if (isStaleLead(lead)) return "stale"
  return "neutral"
}

function getContextTag(lead: Lead) {
  return lead.city?.trim() || lead.location?.trim() || "Location TBD"
}

function isHighValueLead(lead: Lead) {
  return getLeadValue(lead) >= 300000
}

function buildSeries(leads: Lead[], accessor: (lead: Lead) => number) {
  const points = [0, 0, 0, 0, 0, 0]

  leads.forEach((lead) => {
    const ageInDays = Math.floor((Date.now() - new Date(lead.updatedAt).getTime()) / dayInMs)

    if (ageInDays < 0 || ageInDays >= 42) {
      return
    }

    const index = Math.max(0, Math.min(5, 5 - Math.floor(ageInDays / 7)))
    points[index] += accessor(lead)
  })

  return points
}

function getTrend(points: number[]) {
  const current = points.at(-1) ?? 0
  const previous = points.at(-2) ?? 0

  if (previous === 0) {
    if (current === 0) {
      return { direction: "flat" as const, label: "0%" }
    }

    return { direction: "up" as const, label: "New" }
  }

  const delta = Math.round(((current - previous) / previous) * 100)

  if (delta > 0) return { direction: "up" as const, label: `+${delta}%` }
  if (delta < 0) return { direction: "down" as const, label: `${delta}%` }
  return { direction: "flat" as const, label: "0%" }
}

function getHealthScore(leads: Lead[]) {
  const openLeads = leads.filter(isOpenLead)
  if (!openLeads.length) return 100

  const atRiskCount = openLeads.filter(isAtRiskLead).length
  const staleCount = openLeads.filter(isStaleLead).length
  const unassignedCount = openLeads.filter((lead) => !getPrimaryOwner(lead)).length
  const pressure =
    (atRiskCount / openLeads.length) * 48
    + (staleCount / openLeads.length) * 28
    + (unassignedCount / openLeads.length) * 18

  return Math.max(18, Math.round(100 - pressure))
}

function matchesSearch(lead: Lead, searchTerm: string) {
  if (!searchTerm.trim()) return true

  const owner = getPrimaryOwner(lead)
  const haystack = [
    lead.eventType,
    lead.location,
    lead.city,
    getClientLabel(lead.client),
    getOwnerLabel(owner),
    lead.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  return haystack.includes(searchTerm.trim().toLowerCase())
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName
  return (
    target.isContentEditable
    || tagName === "INPUT"
    || tagName === "TEXTAREA"
    || tagName === "SELECT"
    || Boolean(target.closest("[contenteditable='true']"))
  )
}

function Sparkline({
  values,
  tone,
}: {
  values: number[]
  tone: "gold" | "blue" | "green" | "orange" | "red"
}) {
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = Math.max(max - min, 1)

  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100
      const y = 100 - ((value - min) / range) * 100
      return `${x},${Number.isFinite(y) ? y : 100}`
    })
    .join(" ")

  return (
    <svg
      className={`${styles.sparkline} ${styles[`sparkline${tone[0].toUpperCase()}${tone.slice(1)}`]}`}
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline points={points} />
    </svg>
  )
}

function KpiTile({
  label,
  value,
  detail,
  trend,
  series,
  tone,
}: {
  label: string
  value: string
  detail: string
  trend: ReturnType<typeof getTrend>
  series: number[]
  tone: "gold" | "blue" | "green" | "orange" | "red"
}) {
  return (
    <article className={styles.kpiTile}>
      <div className={styles.kpiHeader}>
        <span className={styles.kpiLabel}>{label}</span>
        <span
          className={`${styles.trendBadge} ${
            trend.direction === "up"
              ? styles.trendUp
              : trend.direction === "down"
                ? styles.trendDown
                : styles.trendFlat
          }`}
        >
          {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "•"} {trend.label}
        </span>
      </div>
      <div className={styles.kpiValueRow}>
        <strong className={styles.kpiValue}>{value}</strong>
        <Sparkline values={series} tone={tone} />
      </div>
      <p className={styles.kpiDetail}>{detail}</p>
    </article>
  )
}

function LoadingBoard() {
  return (
    <DashboardPage className={styles.page}>
      <section className={styles.commandBar}>
        <div className={styles.loadingCommand} />
        <div className={styles.loadingFilters}>
          <span className={styles.loadingPill} />
          <span className={styles.loadingPill} />
          <span className={styles.loadingPillWide} />
        </div>
      </section>

      <section className={styles.kpiRibbon}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className={styles.loadingTile} />
        ))}
      </section>

      <section className={styles.executionSection}>
        <div className={styles.loadingBoardRail}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className={styles.loadingLane} />
          ))}
        </div>
      </section>
    </DashboardPage>
  )
}

export default function AdminPipelinePage() {
  const router = useRouter()
  const { pushToast } = useToast()
  const pipeline = useAdminResource(() => adminApi.pipeline(), [], {
    refreshIntervalMs: 30000,
  })
  const team = useAdminResource(
    () =>
      adminApi.listUsers(new URLSearchParams({ page: "1", limit: "100" })).then((response) =>
        response.items.filter(
          (user) => user.role !== "CLIENT" && user.role !== "VENDOR" && user.isActive !== false,
        ),
      ),
    [],
  )
  const me = useAdminResource(() => adminApi.me(), [])

  const [boardLeads, setBoardLeads] = useState<Lead[]>([])
  const [search, setSearch] = useState("")
  const [savedView, setSavedView] = useState<SavedViewId>("all")
  const [ownerFilter, setOwnerFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState<DateFilterId>("all")
  const [sizeFilter, setSizeFilter] = useState<SizeFilterId>("all")
  const [tagFilter, setTagFilter] = useState<TagFilterId>("all")
  const [activeCardId, setActiveCardId] = useState<string | null>(null)
  const [dragLeadId, setDragLeadId] = useState<string | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<LeadStatus | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const deferredSearch = useDeferredValue(search)

  useEffect(() => {
    const nextLeads = pipeline.data
    if (!nextLeads) return

    startTransition(() => {
      setBoardLeads(nextLeads)
    })
  }, [pipeline.data])

  const owners = team.data ?? []
  const currentUserId = me.data?.id ?? null

  const filteredLeads = boardLeads.filter((lead) => {
    if (!matchesSearch(lead, deferredSearch)) return false

    const value = getLeadValue(lead)
    const owner = getPrimaryOwner(lead)

    if (savedView === "mine" && (!currentUserId || owner?.user.id !== currentUserId)) return false
    if (savedView === "this-month" && !isThisMonth(lead.eventDate)) return false
    if (savedView === "at-risk" && !isAtRiskLead(lead)) return false

    if (ownerFilter !== "all" && owner?.user.id !== ownerFilter) return false

    if (dateFilter === "next-30" && !isNext30Days(lead.eventDate)) return false
    if (dateFilter === "this-month" && !isThisMonth(lead.eventDate)) return false
    if (dateFilter === "overdue" && getDaysUntil(lead.eventDate) >= 0) return false

    if (sizeFilter === "under-1l" && value >= 100000) return false
    if (sizeFilter === "1l-3l" && (value < 100000 || value >= 300000)) return false
    if (sizeFilter === "3l-plus" && value < 300000) return false

    if (tagFilter === "high-value" && !isHighValueLead(lead)) return false
    if (tagFilter === "proposal-live" && !isProposalLive(lead)) return false
    if (tagFilter === "stale" && !isStaleLead(lead)) return false
    if (tagFilter === "unassigned" && getPrimaryOwner(lead)) return false

    return true
  })

  const grouped = Object.fromEntries(
    columns.map((status) => [status, filteredLeads.filter((lead) => lead.status === status)]),
  ) as Record<LeadStatus, Lead[]>

  const visibleCards = columns.flatMap((status) => grouped[status])
  const openLeads = filteredLeads.filter(isOpenLead)
  const wonLeads = filteredLeads.filter((lead) => lead.status === "WON")
  const lostLeads = filteredLeads.filter((lead) => lead.status === "LOST")
  const closedCount = wonLeads.length + lostLeads.length
  const openValue = openLeads.reduce((sum, lead) => sum + getLeadValue(lead), 0)
  const avgDealSize = openLeads.length ? Math.round(openValue / openLeads.length) : 0
  const atRiskDeals = openLeads.filter(isAtRiskLead)
  const staleDeals = openLeads.filter(isStaleLead)
  const unassignedDeals = openLeads.filter((lead) => !getPrimaryOwner(lead))
  const thisMonthRevenue = wonLeads
    .filter((lead) => isThisMonth(lead.updatedAt))
    .reduce((sum, lead) => sum + getLeadValue(lead), 0)
  const conversionRate = closedCount ? Math.round((wonLeads.length / closedCount) * 100) : 0
  const syncTone = pipeline.isRefreshing ? "warning" : pipeline.error ? "danger" : "success"
  const syncLabel = pipeline.isRefreshing
    ? "Syncing live data"
    : pipeline.lastLoadedAt
      ? `Synced ${formatRelativeDate(new Date(pipeline.lastLoadedAt).toISOString())}`
      : "Connected"

  const pipelineValueSeries = buildSeries(openLeads, (lead) => getLeadValue(lead))
  const openDealsSeries = buildSeries(openLeads, () => 1)
  const conversionSeries = columns.map((_, index) => {
    const relevant = filteredLeads.filter((lead) => {
      const ageInDays = Math.floor((Date.now() - new Date(lead.updatedAt).getTime()) / dayInMs)
      return Math.max(0, Math.min(5, 5 - Math.floor(Math.max(ageInDays, 0) / 7))) <= index
    })

    const wins = relevant.filter((lead) => lead.status === "WON").length
    const losses = relevant.filter((lead) => lead.status === "LOST").length
    const closes = wins + losses
    return closes ? Math.round((wins / closes) * 100) : 0
  })
  const avgDealSeries = buildSeries(
    openLeads,
    (lead) => getLeadValue(lead) / Math.max(openLeads.length, 1),
  )
  const revenueSeries = buildSeries(wonLeads, (lead) => getLeadValue(lead))
  const riskSeries = buildSeries(atRiskDeals, () => 1)

  useEffect(() => {
    if (!visibleCards.length) {
      setActiveCardId(null)
      return
    }

    if (!activeCardId || !visibleCards.some((lead) => lead.id === activeCardId)) {
      setActiveCardId(visibleCards[0]?.id ?? null)
    }
  }, [activeCardId, visibleCards])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      if (event.key === "/" && !isEditableTarget(event.target)) {
        event.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
        return
      }

      if (event.key.toLowerCase() === "n" && !isEditableTarget(event.target)) {
        event.preventDefault()
        router.push("/admin/bookings/new")
        return
      }

      if (!visibleCards.length || isEditableTarget(event.target)) {
        return
      }

      const currentIndex = visibleCards.findIndex((lead) => lead.id === activeCardId)
      const safeIndex = currentIndex === -1 ? 0 : currentIndex

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault()
        const nextCard = visibleCards[Math.min(safeIndex + 1, visibleCards.length - 1)]
        if (!nextCard) return
        setActiveCardId(nextCard.id)
        document
          .querySelector<HTMLElement>(`[data-card-id="${nextCard.id}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" })
        return
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault()
        const previousCard = visibleCards[Math.max(safeIndex - 1, 0)]
        if (!previousCard) return
        setActiveCardId(previousCard.id)
        document
          .querySelector<HTMLElement>(`[data-card-id="${previousCard.id}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" })
        return
      }

      if (event.key === "Enter" && activeCardId) {
        event.preventDefault()
        router.push(`/admin/leads/${activeCardId}`)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeCardId, router, visibleCards])

  async function moveLeadToStatus(leadId: string, status: LeadStatus) {
    const lead = boardLeads.find((item) => item.id === leadId)
    if (!lead || lead.status === status) {
      return
    }

    const previousBoard = boardLeads

    startTransition(() => {
      setBoardLeads((current) =>
        current.map((item) =>
          item.id === leadId
            ? { ...item, status, updatedAt: new Date().toISOString() }
            : item,
        ),
      )
    })

    try {
      await adminApi.updateLeadStatus(leadId, status)
      pushToast({
        title: `Moved ${getClientLabel(lead.client)} to ${laneLabels[status]}`,
        tone: "success",
      })
      void pipeline.reload("background")
    } catch (error) {
      startTransition(() => {
        setBoardLeads(previousBoard)
      })
      pushToast({
        title: "Unable to update stage",
        description: error instanceof Error ? error.message : "Please retry.",
        tone: "error",
      })
    } finally {
      setDragLeadId(null)
      setDragOverStatus(null)
    }
  }

  if (pipeline.isLoading && !pipeline.data) {
    return <LoadingBoard />
  }

  if (pipeline.error && !pipeline.data) {
    return (
      <EmptyState
        title="Pipeline unavailable"
        description={pipeline.error}
      />
    )
  }

  return (
    <DashboardPage className={styles.page}>
      <section className={styles.commandBar}>
        <div className={styles.commandTop}>
          <div className={styles.searchCluster}>
            <label className={styles.searchField}>
              <SearchIcon className={styles.searchIcon} />
              <input
                ref={searchInputRef}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search deals, clients, owners, or notes"
                className={styles.searchInput}
                aria-label="Search pipeline"
              />
              <span className={styles.shortcutPill}>/</span>
            </label>

            <label className={styles.compactField}>
              <span className={styles.compactFieldLabel}>View</span>
              <select
                value={savedView}
                onChange={(event) => setSavedView(event.target.value as SavedViewId)}
              >
                {savedViews.map((view) => (
                  <option key={view.id} value={view.id}>
                    {view.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.commandActions}>
            <StatusIndicator tone={syncTone}>{syncLabel}</StatusIndicator>
            <Link href="/admin/bookings/new" className={styles.primaryAction}>
              New Opportunity
            </Link>
          </div>
        </div>

        <div className={styles.commandBottom}>
          <div className={styles.filterGroup}>
            <label className={styles.compactField}>
              <span className={styles.compactFieldLabel}>Owner</span>
              <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
                <option value="all">All owners</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name ?? owner.email ?? owner.phone ?? owner.id}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.compactField}>
              <span className={styles.compactFieldLabel}>Date</span>
              <select
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value as DateFilterId)}
              >
                <option value="all">All dates</option>
                <option value="next-30">Next 30 days</option>
                <option value="this-month">This month</option>
                <option value="overdue">Overdue</option>
              </select>
            </label>

            <label className={styles.compactField}>
              <span className={styles.compactFieldLabel}>Size</span>
              <select
                value={sizeFilter}
                onChange={(event) => setSizeFilter(event.target.value as SizeFilterId)}
              >
                <option value="all">All sizes</option>
                <option value="under-1l">Under ₹1L</option>
                <option value="1l-3l">₹1L to ₹3L</option>
                <option value="3l-plus">₹3L+</option>
              </select>
            </label>

            <label className={styles.compactField}>
              <span className={styles.compactFieldLabel}>Tag</span>
              <select
                value={tagFilter}
                onChange={(event) => setTagFilter(event.target.value as TagFilterId)}
              >
                <option value="all">All tags</option>
                <option value="high-value">High value</option>
                <option value="proposal-live">Proposal live</option>
                <option value="stale">Stale</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </label>
          </div>

          <div className={styles.utilityCluster}>
            <span className={styles.metaLabel}>{filteredLeads.length} visible</span>
            <button
              type="button"
              className={styles.ghostAction}
              onClick={() => {
                setSearch("")
                setSavedView("all")
                setOwnerFilter("all")
                setDateFilter("all")
                setSizeFilter("all")
                setTagFilter("all")
              }}
            >
              Reset
            </button>
            <button
              type="button"
              className={styles.ghostAction}
              onClick={() => void pipeline.reload("manual")}
            >
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className={styles.kpiRibbon}>
        <KpiTile
          label="Total Pipeline Value"
          value={formatCompactCurrency(openValue)}
          detail={`${openLeads.length} live opportunities`}
          trend={getTrend(pipelineValueSeries)}
          series={pipelineValueSeries}
          tone="gold"
        />
        <KpiTile
          label="Open Opportunities"
          value={String(openLeads.length)}
          detail={`${grouped.PROPOSAL_SENT.length} waiting on client`}
          trend={getTrend(openDealsSeries)}
          series={openDealsSeries}
          tone="blue"
        />
        <KpiTile
          label="Conversion Rate"
          value={`${conversionRate}%`}
          detail={closedCount ? `${wonLeads.length} won / ${closedCount} closed` : "No closed deals yet"}
          trend={getTrend(conversionSeries)}
          series={conversionSeries}
          tone="green"
        />
        <KpiTile
          label="Avg Deal Size"
          value={formatCompactCurrency(avgDealSize)}
          detail="Open pipeline average"
          trend={getTrend(avgDealSeries)}
          series={avgDealSeries}
          tone="gold"
        />
        <KpiTile
          label="This Month Revenue"
          value={formatCompactCurrency(thisMonthRevenue)}
          detail={`${wonLeads.filter((lead) => isThisMonth(lead.updatedAt)).length} wins this month`}
          trend={getTrend(revenueSeries)}
          series={revenueSeries}
          tone="green"
        />
        <KpiTile
          label="At-Risk Deals"
          value={String(atRiskDeals.length)}
          detail={`${unassignedDeals.length} unassigned / ${staleDeals.length} stale`}
          trend={getTrend(riskSeries)}
          series={riskSeries}
          tone="red"
        />
      </section>

      <section className={styles.executionSection}>
        {visibleCards.length ? (
          <div className={styles.boardRail}>
            {columns.map((status) => {
              const leads = grouped[status]
              const laneValue = leads.reduce((sum, lead) => sum + getLeadValue(lead), 0)

              return (
                <section
                  key={status}
                  className={`${styles.lane} ${laneColorClassName[status]} ${
                    dragOverStatus === status ? styles.laneDragTarget : ""
                  }`}
                  onDragOver={(event) => {
                    event.preventDefault()
                    if (dragLeadId) {
                      setDragOverStatus(status)
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    if (dragLeadId) {
                      void moveLeadToStatus(dragLeadId, status)
                    }
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setDragOverStatus((current) => (current === status ? null : current))
                    }
                  }}
                >
                  <div className={styles.laneHeader}>
                    <div className={styles.laneHeaderTop}>
                      <div className={styles.laneHeading}>
                        <span className={styles.laneDot} />
                        <div>
                          <h3 className={styles.laneTitle}>{laneLabels[status]}</h3>
                          <p className={styles.laneDescription}>{laneDescriptions[status]}</p>
                        </div>
                      </div>

                    </div>

                    <div className={styles.laneMetrics}>
                      <span>{leads.length} deals</span>
                      <strong>{formatCompactCurrency(laneValue)}</strong>
                    </div>
                  </div>

                  <div className={styles.laneBody}>
                    {leads.length ? (
                      leads.map((lead) => {
                        const clientLabel = getClientLabel(lead.client)
                        const owner = getPrimaryOwner(lead)
                        const ownerLabel = getOwnerLabel(owner)
                        const attachmentCount = lead.proposals?.length ?? 0
                        const notesCount = lead.internalNotes?.length ?? 0
                        const priorityTone = getPriorityTone(lead)
                        const freshnessTone = getFreshnessTone(lead)

                        return (
                          <article
                            key={lead.id}
                            data-card-id={lead.id}
                            draggable
                            onDragStart={() => setDragLeadId(lead.id)}
                            onDragEnd={() => {
                              setDragLeadId(null)
                              setDragOverStatus(null)
                            }}
                            onMouseEnter={() => setActiveCardId(lead.id)}
                            className={`${styles.dealCard} ${activeCardId === lead.id ? styles.dealCardActive : ""} ${
                              isAtRiskLead(lead) ? styles.dealCardRisk : ""
                            } ${isStaleLead(lead) ? styles.dealCardStale : ""} ${
                              isRecentLead(lead) ? styles.dealCardRecent : ""
                            } ${isHighValueLead(lead) ? styles.dealCardHighValue : ""} ${
                              dragLeadId === lead.id ? styles.dealCardDragging : ""
                            }`}
                          >

                            <Link
                              href={`/admin/leads/${lead.id}`}
                              className={styles.cardLink}
                              onFocus={() => setActiveCardId(lead.id)}
                            >
                              <div className={styles.cardHeader}>
                                <div className={styles.clientBlock}>
                                  <span className={styles.avatar}>{getAvatarLabel(clientLabel)}</span>
                                  <div>
                                    <p className={styles.clientName}>{clientLabel}</p>
                                    <p className={styles.eventName}>{lead.eventType}</p>
                                  </div>
                                </div>

                                {isAtRiskLead(lead) ? (
                                  <span className={`${styles.flag} ${styles.flagWarning}`}>At risk</span>
                                ) : null}
                              </div>

                              <div className={styles.valueBlock}>
                                <strong className={styles.dealValue}>
                                  {formatCompactCurrency(getLeadValue(lead))}
                                </strong>
                                <span className={styles.dealRange}>{formatBudgetLabel(lead)}</span>
                              </div>

                              <div className={styles.cardMeta}>
                                <span className={styles.metaChip}>Event {formatDateOnly(lead.eventDate)}</span>
                                <span className={`${styles.metaChip} ${
                                  priorityTone === "critical"
                                    ? styles.priorityCritical
                                    : priorityTone === "warning"
                                      ? styles.priorityWarning
                                      : styles.priorityNeutral
                                }`}>
                                  {getPriorityLabel(lead)}
                                </span>
                                <span className={styles.metaChip}>{getContextTag(lead)}</span>
                              </div>

                              <div className={styles.signalStack}>
                                <span
                                  className={`${styles.inlineSignal} ${
                                    freshnessTone === "fresh"
                                      ? styles.inlineSignalFresh
                                      : freshnessTone === "stale"
                                        ? styles.inlineSignalStale
                                        : ""
                                  }`}
                                >
                                  <UpdatesIcon width={13} height={13} />
                                  {getFreshnessLabel(lead)}
                                </span>
                                <span className={styles.inlineSignal}>
                                  <TimelineIcon width={13} height={13} />
                                  {notesCount} notes
                                </span>
                                <span className={styles.inlineSignal}>
                                  <AttachmentIcon width={13} height={13} />
                                  {attachmentCount} docs
                                </span>
                              </div>

                              <div className={styles.cardFooter}>
                                <div className={styles.ownerPill}>
                                  <span className={styles.ownerAvatar}>
                                    {getAvatarLabel(ownerLabel)}
                                  </span>
                                  <span>{ownerLabel}</span>
                                </div>
                                <ArrowUpRightIcon width={14} height={14} className={styles.cardArrow} />
                              </div>
                            </Link>
                          </article>
                        )
                      })
                    ) : (
                      <div className={styles.emptyLane}>
                        <p className={styles.emptyLaneTitle}>Nothing here right now</p>
                        <p className={styles.emptyLaneCopy}>
                          {status === "WON" || status === "LOST"
                            ? "Closed deals will collect here as the funnel matures."
                            : "Drop a card into this lane."}
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        ) : (
          <div className={styles.emptyBoard}>
            <p className={styles.emptyBoardTitle}>No deals match the current view</p>
            <p className={styles.emptyBoardCopy}>
              Clear the active filters or switch saved views to bring the board back into focus.
            </p>
            <button
              type="button"
              className={styles.primaryAction}
              onClick={() => {
                setSearch("")
                setSavedView("all")
                setOwnerFilter("all")
                setDateFilter("all")
                setSizeFilter("all")
                setTagFilter("all")
              }}
            >
              Reset filters
            </button>
          </div>
        )}
      </section>
    </DashboardPage>
  )
}
