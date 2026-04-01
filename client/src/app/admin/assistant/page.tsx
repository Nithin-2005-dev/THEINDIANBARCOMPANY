"use client"

import { useEffect, useMemo, useState } from "react"
import {
  DashboardPage,
  DashboardSearchField,
  EmptyState,
  ErrorState,
  MetricCard,
  PageHero,
  SkeletonMetricGrid,
  SkeletonPageHero,
  SkeletonSurface,
  StatusIndicator,
  Surface,
} from "@/components/dashboard/DashboardPrimitives"
import { useAdminResource } from "@/components/admin/useAdminResource"
import { adminApi } from "@/lib/admin-client"
import type { AdminAssistantPageInsight, AdminRole } from "@/types/admin"
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table/Table"
import styles from "./page.module.css"

const rangeOptions = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
] as const

const roleOptions: Array<{ value: "all" | AdminRole; label: string }> = [
  { value: "all", label: "All roles" },
  { value: "ADMIN", label: "Admin" },
  { value: "SALES", label: "Sales" },
  { value: "OPS", label: "Ops" },
  { value: "FINANCE", label: "Finance" },
  { value: "CLIENT", label: "Client" },
  { value: "VENDOR", label: "Vendor" },
]

export default function AssistantAnalyticsPage() {
  const [range, setRange] = useState<(typeof rangeOptions)[number]["value"]>("30d")
  const [role, setRole] = useState<"all" | AdminRole>("all")
  const [pageKey, setPageKey] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearch(searchInput.trim())
    }, 240)

    return () => window.clearTimeout(timeoutId)
  }, [searchInput])

  const { data, error, isLoading, isRefreshing, lastLoadedAt } = useAdminResource(
    async () =>
      adminApi.assistantAnalytics({
        range,
        role,
        pageKey: pageKey.trim() || undefined,
        search: search.trim() || undefined,
      }),
    [range, role, pageKey, search],
  )

  const pageOptions = useMemo<AdminAssistantPageInsight[]>(() => {
    const map = new Map<string, AdminAssistantPageInsight>()
    for (const option of data?.topPages ?? []) {
      map.set(option.pageKey, option)
    }

    if (pageKey.trim() && !map.has(pageKey.trim())) {
      map.set(pageKey.trim(), {
        pageKey: pageKey.trim(),
        label: humanizeAssistantLabel(pageKey.trim()),
        count: 0,
      })
    }

    return [...map.values()]
  }, [data?.topPages, pageKey])

  const selectedRangeLabel =
    rangeOptions.find((option) => option.value === range)?.label ?? "30 days"
  const selectedRoleLabel =
    roleOptions.find((option) => option.value === role)?.label ?? "All roles"
  const selectedPageLabel = pageOptions.find(
    (option) => option.pageKey === pageKey.trim(),
  )?.label
  const comparison = data?.comparison

  if (isLoading) {
    return (
      <DashboardPage>
        <SkeletonPageHero />
        <SkeletonMetricGrid count={6} />
        <div className={styles.splitGrid}>
          <SkeletonSurface itemCount={5} />
          <SkeletonSurface itemCount={4} />
        </div>
        <div className={styles.splitGrid}>
          <SkeletonSurface itemCount={5} />
          <SkeletonSurface itemCount={5} />
        </div>
        <div className={styles.splitGrid}>
          <SkeletonSurface itemCount={5} />
          <SkeletonSurface itemCount={5} />
        </div>
      </DashboardPage>
    )
  }

  if (error || !data) {
    return (
      <ErrorState
        title="Assistant analytics unavailable"
        description={error ?? "Unable to load assistant telemetry."}
        action={{ label: "Retry", onClick: () => window.location.reload() }}
      />
    )
  }

  const topIntents = data.topIntents ?? data.mostCommonPrompts
  const topUnansweredPrompts = data.topUnansweredPrompts ?? []
  const topBookingPrompts = data.topBookingPrompts ?? []
  const mostUsedActionButtons = data.mostUsedActionButtons ?? data.actionUsage.map((row) => ({
    label: row.action,
    count: row.count,
    samplePrompt: null,
  }))
  const busiestHours = [...(data.busiestHours ?? [])]
    .sort((left, right) => right.count - left.count)
    .slice(0, 8)
  const roleMix = data.topRoles ?? []
  const topPages = pageOptions
  const searchTerms = data.searchTerms ?? []
  const escalationTriggers = data.topEscalationTriggers ?? []
  const trend = data.trend ?? []
  const trendMax = Math.max(
    1,
    ...trend.map((point) => Math.max(point.messages, point.opens, point.fallbacks)),
  )
  const hourMax = Math.max(1, ...busiestHours.map((item) => item.count))

  return (
    <DashboardPage>
      <PageHero
        eyebrow="Assistant analytics"
        title="Beer the Bear"
        description={`Track conversation volume, fallback behavior, page usage, and the shortcuts that are actually earning clicks across ${selectedRoleLabel.toLowerCase()}.`}
        action={{ label: "Open chat", href: "/admin/chat" }}
        secondaryAction={{ label: "Open bookings", href: "/admin/bookings" }}
      />

      <section className={styles.filterBar}>
        <div className={styles.filterRow}>
          <div className={styles.segmentedGroup}>
            {rangeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`${styles.segmentButton} ${range === option.value ? styles.segmentButtonActive : ""}`}
                onClick={() => setRange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <DashboardSearchField
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search assistant history"
            ariaLabel="Search assistant history"
            className={styles.searchField}
          />

          <div className={styles.selectWrap}>
            <select
              className={styles.select}
              value={role}
              onChange={(event) => setRole(event.target.value as "all" | AdminRole)}
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.selectWrap}>
            <select
              className={styles.select}
              value={pageKey}
              onChange={(event) => setPageKey(event.target.value)}
            >
              <option value="">All pages</option>
              {topPages.map((option) => (
                <option key={option.pageKey} value={option.pageKey}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterStatus}>
            <StatusIndicator tone="neutral">{selectedRangeLabel}</StatusIndicator>
            <StatusIndicator tone="neutral">{selectedRoleLabel}</StatusIndicator>
            <StatusIndicator tone="neutral">
              {selectedPageLabel ?? "All pages"}
            </StatusIndicator>
          </div>
        </div>
        <p className={styles.filterCopy}>
          {isRefreshing
            ? "Refreshing Beer telemetry."
            : lastLoadedAt
              ? `Last updated ${formatRelativeTimestamp(lastLoadedAt)}`
              : "Telemetry updates as conversations and actions come in."}
        </p>
      </section>

      <div className={styles.metricGrid}>
        <MetricCard
          label="Conversations"
          value={data.totalConversations}
          hint="Threads with activity in the selected window."
          emphasis={formatMetricDelta(comparison?.delta.conversations ?? 0)}
        />
        <MetricCard
          label="Active users"
          value={data.activeUsers}
          hint="Distinct users who opened or messaged Beer."
          emphasis={formatMetricDelta(comparison?.delta.activeUsers ?? 0)}
        />
        <MetricCard
          label="Avg thread length"
          value={data.averageThreadLength}
          hint="Average messages per active conversation."
          emphasis={formatMetricDelta(
            comparison?.delta.messages ?? 0,
            " msgs",
          )}
        />
        <MetricCard
          label="Fallback rate"
          value={`${data.fallbackRate}%`}
          hint="Lower is better. This is unanswered turns divided by replies."
          emphasis={formatMetricDelta(comparison?.delta.fallbackRate ?? 0, "%")}
        />
        <MetricCard
          label="Avg response time"
          value={formatDuration(data.averageResponseTimeMs)}
          hint="Measured from prompt to assistant response."
          emphasis={formatMetricDelta(
            comparison?.delta.averageResponseTimeMs ?? 0,
            " ms",
          )}
        />
        <MetricCard
          label="Pinned / archived"
          value={`${data.pinnedConversations} / ${data.archivedConversations}`}
          hint="Pinned conversations on the left, archived conversations on the right."
          emphasis="thread state"
        />
      </div>

      <div className={styles.splitGrid}>
        <Surface
          title="Usage trend"
          description="Daily assistant activity, fallback spikes, and response time patterns for the selected scope."
          className={styles.scrollSurface}
          headerAction={
            <div className={styles.surfacePills}>
              <StatusIndicator
                tone={
                  (comparison?.delta.fallbackRate ?? 0) <= 0
                    ? "success"
                    : "warning"
                }
              >
                Fallback {formatSignedNumber(comparison?.delta.fallbackRate ?? 0, "%")}
              </StatusIndicator>
              <StatusIndicator
                tone={
                  (comparison?.delta.averageResponseTimeMs ?? 0) <= 0
                    ? "success"
                    : "warning"
                }
              >
                Reply time {formatSignedNumber(
                  comparison?.delta.averageResponseTimeMs ?? 0,
                  " ms",
                )}
              </StatusIndicator>
            </div>
          }
        >
          {trend.length ? (
            <div className={styles.trendList}>
              {trend.map((point) => {
                const total = Math.max(
                  1,
                  point.opens + point.messages + point.responses + point.fallbacks,
                )
                const width = Math.max(8, (point.messages / trendMax) * 100)

                return (
                  <div key={point.date} className={styles.trendRow}>
                    <div className={styles.trendMeta}>
                      <div>
                        <p className={styles.trendLabel}>{point.label}</p>
                        <p className={styles.trendCopy}>
                          {point.messages} messages, {point.fallbacks} fallbacks
                        </p>
                      </div>
                      <p className={styles.trendValue}>
                        {formatDuration(point.avgResponseTimeMs ?? 0)}
                      </p>
                    </div>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFill}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <div className={styles.trendStats}>
                      <span>{point.opens} opens</span>
                      <span>{point.responses} replies</span>
                      <span>{total} total actions</span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState
              title="No trend data yet"
              description="Beer will start populating this chart as soon as people open the assistant and send messages."
              align="center"
            />
          )}
        </Surface>

        <Surface
          title="Conversation mix"
          description="How Beer is being used across roles, and how much of the thread pool is pinned or archived."
          className={styles.scrollSurface}
        >
          <div className={styles.stack}>
            <div className={styles.mixCards}>
              <div className={styles.mixCard}>
                <p className={styles.mixLabel}>Pinned</p>
                <p className={styles.mixValue}>{data.pinnedConversations}</p>
              </div>
              <div className={styles.mixCard}>
                <p className={styles.mixLabel}>Archived</p>
                <p className={styles.mixValue}>{data.archivedConversations}</p>
              </div>
              <div className={styles.mixCard}>
                <p className={styles.mixLabel}>Open pages</p>
                <p className={styles.mixValue}>{topPages.length}</p>
              </div>
            </div>

            <TableContainer className={styles.tableWrap}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roleMix.length ? (
                    roleMix.map((row) => (
                      <TableRow key={row.role}>
                        <TableCell className={styles.tableStrong}>
                          {humanizeAssistantLabel(row.role)}
                        </TableCell>
                        <TableCell>{row.count}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={2}>
                        <EmptyState
                          title="No role data yet"
                          description="Beer will classify role usage once users start opening the assistant."
                          align="left"
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </div>
        </Surface>
      </div>

      <div className={styles.splitGrid}>
        <Surface
          title="Top intents"
          description="The most common reasons people open Beer."
          className={styles.scrollSurface}
        >
          <TableContainer className={styles.tableWrap}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Intent</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead>Sample</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topIntents.length ? (
                  topIntents.map((row) => (
                    <TableRow key={row.label}>
                      <TableCell className={styles.tableStrong}>
                        {humanizeAssistantLabel(row.label)}
                      </TableCell>
                      <TableCell>{row.count}</TableCell>
                      <TableCell className={styles.tableMuted}>
                        {row.samplePrompt ?? "No sample captured."}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <EmptyState
                        title="No intent data yet"
                        description="Once Beer receives traffic, the most common intents will appear here."
                        align="left"
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Surface>

        <Surface
          title="Most common pages"
          description="Where Beer is opened most often."
          className={styles.scrollSurface}
        >
          <TableContainer className={styles.tableWrap}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead>Sample</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topPages.length ? (
                  topPages.map((row) => (
                    <TableRow key={row.pageKey}>
                      <TableCell className={styles.tableStrong}>
                        {row.label}
                      </TableCell>
                      <TableCell>{row.count}</TableCell>
                      <TableCell className={styles.tableMuted}>
                        {row.samplePrompt ?? row.pageKey}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <EmptyState
                        title="No page usage yet"
                        description="Beer will record the page that was open each time the panel launches."
                        align="left"
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Surface>
      </div>

      <div className={styles.splitGrid}>
        <Surface
          title="Unanswered prompts"
          description="Fallback questions and the phrases that need stronger handling."
          className={styles.scrollSurface}
        >
          <TableContainer className={styles.tableWrap}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prompt</TableHead>
                  <TableHead>Intent</TableHead>
                  <TableHead>Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topUnansweredPrompts.length ? (
                  topUnansweredPrompts.map((row) => (
                    <TableRow key={`${row.label}-${row.count}`}>
                      <TableCell className={styles.tableStrong}>
                        {row.samplePrompt ?? row.label}
                      </TableCell>
                      <TableCell className={styles.tableMuted}>
                        {humanizeAssistantLabel(row.intent ?? "fallback")}
                      </TableCell>
                      <TableCell>{row.count}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <EmptyState
                        title="No unanswered prompts yet"
                        description="Fallback prompts will appear here once Beer starts missing questions."
                        align="left"
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Surface>

        <Surface
          title="Booking prompts"
          description="The most common next-step questions tied to bookings and operations."
          className={styles.scrollSurface}
        >
          <TableContainer className={styles.tableWrap}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prompt</TableHead>
                  <TableHead>Page</TableHead>
                  <TableHead>Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topBookingPrompts.length ? (
                  topBookingPrompts.map((row) => (
                    <TableRow key={`${row.label}-${row.count}`}>
                      <TableCell className={styles.tableStrong}>
                        {row.samplePrompt ?? row.label}
                      </TableCell>
                      <TableCell className={styles.tableMuted}>
                        {row.pageKey ? humanizeAssistantLabel(row.pageKey) : "General"}
                      </TableCell>
                      <TableCell>{row.count}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <EmptyState
                        title="No booking prompts yet"
                        description="Booking-related questions will appear here as people start asking them."
                        align="left"
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Surface>
      </div>

      <div className={styles.splitGrid}>
        <Surface
          title="Action buttons"
          description="Which shortcuts are getting used the most."
          className={styles.scrollSurface}
        >
          <TableContainer className={styles.tableWrap}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead>Sample</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mostUsedActionButtons.length ? (
                  mostUsedActionButtons.map((row) => (
                    <TableRow key={row.label}>
                      <TableCell className={styles.tableStrong}>
                        {row.label}
                      </TableCell>
                      <TableCell>{row.count}</TableCell>
                      <TableCell className={styles.tableMuted}>
                        {row.samplePrompt ?? "Shortcut usage"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <EmptyState
                        title="No action usage yet"
                        description="The most used action buttons will show up here once users start clicking them."
                        align="left"
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Surface>

        <Surface
          title="Escalation triggers"
          description="What tends to make Beer hand the conversation back to a human."
          className={styles.scrollSurface}
        >
          <TableContainer className={styles.tableWrap}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead>Sample</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {escalationTriggers.length ? (
                  escalationTriggers.map((row) => (
                    <TableRow key={row.label}>
                      <TableCell className={styles.tableStrong}>
                        {row.label}
                      </TableCell>
                      <TableCell>{row.count}</TableCell>
                      <TableCell className={styles.tableMuted}>
                        {row.samplePrompt ?? "Escalation recorded."}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <EmptyState
                        title="No escalation data yet"
                        description="Beer will show the reasons it escalated once handoffs start happening."
                        align="left"
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Surface>
      </div>

      <div className={styles.splitGrid}>
        <Surface
          title="Search terms"
          description="What people search for inside assistant history."
          className={styles.scrollSurface}
        >
          <TableContainer className={styles.tableWrap}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Term</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead>Sample</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchTerms.length ? (
                  searchTerms.map((row) => (
                    <TableRow key={row.term}>
                      <TableCell className={styles.tableStrong}>
                        {row.term}
                      </TableCell>
                      <TableCell>{row.count}</TableCell>
                      <TableCell className={styles.tableMuted}>
                        {row.samplePrompt ?? "Search event"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <EmptyState
                        title="No search terms yet"
                        description="Conversation search queries will show up here after people start filtering their threads."
                        align="left"
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Surface>

        <Surface
          title="Busiest hours"
          description="When Beer sees the most activity."
          className={styles.scrollSurface}
        >
          {busiestHours.length ? (
            <div className={styles.hourList}>
              {busiestHours.map((row) => {
                const width = Math.max(8, (row.count / hourMax) * 100)

                return (
                  <div key={row.hour} className={styles.hourRow}>
                    <div className={styles.hourMeta}>
                      <p className={styles.hourLabel}>{row.label}</p>
                      <p className={styles.hourCount}>{row.count}</p>
                    </div>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFillMuted}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState
              title="No hourly data yet"
              description="Beer will start filling in the busiest hours chart once there is traffic."
              align="center"
            />
          )}
        </Surface>
      </div>
    </DashboardPage>
  )
}

function humanizeAssistantLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function formatDuration(value: number) {
  if (!value) {
    return "0 ms"
  }

  if (value < 1000) {
    return `${value} ms`
  }

  if (value < 60_000) {
    return `${(value / 1000).toFixed(1)} s`
  }

  return `${(value / 60_000).toFixed(1)} min`
}

function formatMetricDelta(value: number, suffix = "") {
  if (!value) {
    return "0 vs prev"
  }

  return `${formatSignedNumber(value, suffix)} vs prev`
}

function formatSignedNumber(value: number, suffix = "") {
  const sign = value > 0 ? "+" : value < 0 ? "-" : ""
  return `${sign}${Math.abs(value).toFixed(suffix === "%" ? 1 : 0)}${suffix}`
}

function formatRelativeTimestamp(value: number) {
  const diffMinutes = Math.round((Date.now() - value) / 60_000)
  if (Math.abs(diffMinutes) < 60) {
    return `${Math.abs(diffMinutes)} minute${Math.abs(diffMinutes) === 1 ? "" : "s"} ago`
  }

  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) {
    return `${Math.abs(diffHours)} hour${Math.abs(diffHours) === 1 ? "" : "s"} ago`
  }

  const diffDays = Math.round(diffHours / 24)
  return `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"} ago`
}
