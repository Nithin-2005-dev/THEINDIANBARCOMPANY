"use client"

import { useDeferredValue, useEffect, useMemo, useState } from "react"
import StatusBadge from "@/components/admin/StatusBadge"
import { useAdminResource } from "@/components/admin/useAdminResource"
import {
  DashboardButton,
  DashboardPage,
  DashboardSearchField,
  EmptyState,
  ErrorState,
  InlineNotice,
  MetricCard,
  PageHero,
  SkeletonMetricGrid,
  SkeletonPageHero,
  SkeletonSurface,
  Surface,
  WorkspaceTabs,
} from "@/components/dashboard/DashboardPrimitives"
import { EmailIcon } from "@/components/dashboard/icons"
import { useToast } from "@/components/dashboard/ToastProvider"
import { showApiErrorToast } from "@/lib/api"
import { adminApi } from "@/lib/admin-client"
import { formatDate, formatRelativeDate } from "@/lib/admin-format"
import type { AdminEmailDelivery } from "@/types/admin"
import styles from "./page.module.css"

const STATUS_TABS = [
  { id: "ALL", label: "All" },
  { id: "PENDING", label: "Pending" },
  { id: "RETRYING", label: "Retrying" },
  { id: "SENT", label: "Sent" },
  { id: "FAILED", label: "Failed" },
] as const

function getStatusToneCopy(status: AdminEmailDelivery["status"]) {
  switch (status) {
    case "FAILED":
      return "Failed permanently"
    case "RETRYING":
      return "Retry scheduled"
    case "PROCESSING":
      return "Attempt in progress"
    case "QUEUED":
      return "Queued for delivery"
    case "SENT":
      return "Provider acknowledged"
    default:
      return status
  }
}

export default function AdminEmailTrackingPage() {
  const { pushToast } = useToast()
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]["id"]>("ALL")
  const [search, setSearch] = useState("")
  const [emailType, setEmailType] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const deferredSearch = useDeferredValue(search)

  const { data, error, isLoading, isRefreshing, reload } = useAdminResource(
    () =>
      adminApi.listEmailDeliveries({
        page: 1,
        limit: 25,
        status: status === "ALL" ? undefined : status,
        search: deferredSearch || undefined,
        emailType: emailType || undefined,
        dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
        dateTo: dateTo
          ? new Date(`${dateTo}T23:59:59.999`).toISOString()
          : undefined,
      }),
    [status, deferredSearch, emailType, dateFrom, dateTo],
    { refreshIntervalMs: 15_000 },
  )

  useEffect(() => {
    if (!data?.items.length) {
      setSelectedId(null)
      return
    }

    if (!selectedId || !data.items.some((item) => item.id === selectedId)) {
      setSelectedId(data.items[0]?.id ?? null)
    }
  }, [data, selectedId])

  const selectedEmail = useMemo(
    () => data?.items.find((item) => item.id === selectedId) ?? null,
    [data, selectedId],
  )

  const tabs = useMemo(() => {
    const summary = data?.summary
    return STATUS_TABS.map((tab) => {
      if (tab.id === "ALL") {
        return {
          id: tab.id,
          label: tab.label,
          badge: summary?.total ?? undefined,
          icon: EmailIcon,
        }
      }

      const badge =
        tab.id === "PENDING"
          ? (summary?.queued ?? 0) + (summary?.processing ?? 0)
          : tab.id === "RETRYING"
            ? summary?.retrying ?? 0
            : tab.id === "SENT"
              ? summary?.sent ?? 0
              : summary?.failed ?? 0

      return {
        id: tab.id,
        label: tab.label,
        badge,
        icon: EmailIcon,
      }
    })
  }, [data?.summary])

  async function handleResend(email: AdminEmailDelivery) {
    try {
      setActingId(email.id)
      await adminApi.resendEmailDelivery(email.id)
      await reload()
    } catch (nextError) {
      showApiErrorToast({ pushToast }, nextError, "Unable to resend email")
    } finally {
      setActingId(null)
    }
  }

  async function handleForceSend(email: AdminEmailDelivery) {
    try {
      setActingId(email.id)
      await adminApi.forceSendEmailDelivery(email.id)
      await reload()
    } catch (nextError) {
      showApiErrorToast({ pushToast }, nextError, "Unable to force-send email")
    } finally {
      setActingId(null)
    }
  }

  if (isLoading) {
    return (
      <DashboardPage>
        <SkeletonPageHero />
        <SkeletonMetricGrid count={5} />
        <div className={styles.contentGrid}>
          <SkeletonSurface itemCount={5} />
          <SkeletonSurface itemCount={6} />
        </div>
      </DashboardPage>
    )
  }

  if (error || !data) {
    return (
      <ErrorState
        title="Email tracking unavailable"
        description={error ?? "Unable to load email delivery data."}
      />
    )
  }

  const canResend =
    selectedEmail?.allowManualResend === true &&
    selectedEmail.status === "FAILED"
  const canForceSend =
    selectedEmail?.allowManualResend === true &&
    selectedEmail.status !== "SENT" &&
    selectedEmail.status !== "PROCESSING"

  return (
    <DashboardPage>
      <PageHero
        eyebrow="Admin Command"
        title="Email tracking"
        description="Watch every outgoing email move from queued to provider acknowledgement, investigate failures, and recover important deliveries without blocking core operations."
      />

      <div className={styles.metricGrid}>
        <MetricCard label="Total emails" value={data.summary.total} hint="Across the active query window." />
        <MetricCard label="Pending" value={data.summary.queued + data.summary.processing} hint="Queued or currently processing." />
        <MetricCard label="Retrying" value={data.summary.retrying} hint="Automatic backoff is active." />
        <MetricCard label="Sent" value={data.summary.sent} hint="Provider acknowledged delivery." />
        <MetricCard label="Failed" value={data.summary.failed} hint="Manual recovery may be needed." />
      </div>

      <Surface
        title="Filters"
        description="Search by recipient, email type, booking or project IDs, provider message id, or user identity."
      >
        <WorkspaceTabs tabs={tabs} activeTab={status} onChange={(tabId) => setStatus(tabId as typeof status)} />
        <div className={styles.filterRow}>
          <DashboardSearchField
            value={search}
            onChange={setSearch}
            placeholder="Search by recipient, type, booking ID, or provider id"
            ariaLabel="Search email deliveries"
          />
          <label className={styles.filterField}>
            <span className={styles.filterLabel}>Email Type</span>
            <select
              className={styles.filterSelect}
              value={emailType}
              onChange={(event) => setEmailType(event.target.value)}
            >
              <option value="">All types</option>
              {data.emailTypes.map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.filterField}>
            <span className={styles.filterLabel}>From</span>
            <input
              className={styles.filterInput}
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </label>
          <label className={styles.filterField}>
            <span className={styles.filterLabel}>To</span>
            <input
              className={styles.filterInput}
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </label>
        </div>
        {isRefreshing ? (
          <InlineNotice
            tone="success"
            title="Refreshing"
            description="New queue and provider updates are loading in the background."
          />
        ) : null}
      </Surface>

      <div className={styles.contentGrid}>
        <Surface
          title="Outgoing emails"
          description={`${data.meta.total} delivery record${data.meta.total === 1 ? "" : "s"} matched the current filters.`}
        >
          {data.items.length ? (
            <div className={styles.listStack}>
              {data.items.map((email) => (
                <button
                  key={email.id}
                  type="button"
                  className={`${styles.listCard} ${email.id === selectedId ? styles.listCardActive : ""}`}
                  onClick={() => setSelectedId(email.id)}
                >
                  <div className={styles.cardTop}>
                    <div>
                      <p className={styles.title}>{email.subject}</p>
                      <p className={styles.copy}>{email.toEmail}</p>
                    </div>
                    <StatusBadge value={email.status} />
                  </div>
                  <div className={styles.cardMetaRow}>
                    <span className={styles.meta}>{email.emailType.replaceAll("_", " ")}</span>
                    <span className={styles.meta}>
                      {email.leadId ? `Booking ${email.leadId.slice(0, 8).toUpperCase()}` : email.projectId ? `Project ${email.projectId.slice(0, 8).toUpperCase()}` : "No linked record"}
                    </span>
                  </div>
                  <p className={styles.copy}>
                    {email.lastErrorMessage
                      ? email.lastErrorMessage
                      : email.providerMessageId
                        ? `Provider id ${email.providerMessageId}`
                        : getStatusToneCopy(email.status)}
                  </p>
                  <div className={styles.cardMetaRow}>
                    <span className={styles.meta}>Created {formatRelativeDate(email.createdAt)}</span>
                    <span className={styles.meta}>
                      Retries {email.retryCount}/{email.maxRetries}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No emails found"
              description="Try widening the date range, clearing the search term, or switching to a different status bucket."
              align="left"
            />
          )}
        </Surface>

        <Surface
          title={selectedEmail ? "Delivery detail" : "Choose an email"}
          description={
            selectedEmail
              ? "Inspect retry history, provider acknowledgement, and any failure detail for the selected email."
              : "Select an email from the list to inspect its delivery history."
          }
        >
          {selectedEmail ? (
            <div className={styles.detailStack}>
              <div className={styles.detailHeader}>
                <div>
                  <p className={styles.title}>{selectedEmail.subject}</p>
                  <p className={styles.copy}>{selectedEmail.toEmail}</p>
                </div>
                <StatusBadge value={selectedEmail.status} />
              </div>

              <div className={styles.detailActions}>
                <DashboardButton
                  tone="secondary"
                  disabled={!canResend || actingId === selectedEmail.id}
                  onClick={() => void handleResend(selectedEmail)}
                >
                  {actingId === selectedEmail.id && canResend ? "Resending..." : "Resend failed email"}
                </DashboardButton>
                <DashboardButton
                  tone="ghost"
                  disabled={!canForceSend || actingId === selectedEmail.id}
                  onClick={() => void handleForceSend(selectedEmail)}
                >
                  {actingId === selectedEmail.id && canForceSend ? "Sending..." : "Force send now"}
                </DashboardButton>
              </div>

              {selectedEmail.lastErrorMessage ? (
                <InlineNotice
                  tone="error"
                  title="Latest failure reason"
                  description={selectedEmail.lastErrorMessage}
                />
              ) : null}

              {!selectedEmail.allowManualResend ? (
                <InlineNotice
                  tone="warning"
                  title="Manual resend disabled"
                  description="Sensitive emails such as OTP requests must be regenerated from their source workflow instead of being resent from admin."
                />
              ) : null}

              <div className={styles.metaGrid}>
                <div className={styles.metaCard}>
                  <span className={styles.label}>Email Type</span>
                  <span className={styles.value}>{selectedEmail.emailType.replaceAll("_", " ")}</span>
                </div>
                <div className={styles.metaCard}>
                  <span className={styles.label}>Template</span>
                  <span className={styles.value}>{selectedEmail.template}</span>
                </div>
                <div className={styles.metaCard}>
                  <span className={styles.label}>Created</span>
                  <span className={styles.value}>{formatDate(selectedEmail.createdAt)}</span>
                </div>
                <div className={styles.metaCard}>
                  <span className={styles.label}>Sent</span>
                  <span className={styles.value}>{formatDate(selectedEmail.sentAt)}</span>
                </div>
                <div className={styles.metaCard}>
                  <span className={styles.label}>Next Retry</span>
                  <span className={styles.value}>{formatDate(selectedEmail.nextRetryAt)}</span>
                </div>
                <div className={styles.metaCard}>
                  <span className={styles.label}>Retries</span>
                  <span className={styles.value}>{selectedEmail.retryCount} / {selectedEmail.maxRetries}</span>
                </div>
                <div className={styles.metaCard}>
                  <span className={styles.label}>Provider Ack</span>
                  <span className={styles.value}>
                    {selectedEmail.providerAcknowledgedAt
                      ? formatDate(selectedEmail.providerAcknowledgedAt)
                      : "Awaiting acknowledgement"}
                  </span>
                </div>
                <div className={styles.metaCard}>
                  <span className={styles.label}>Linked Booking</span>
                  <span className={styles.value}>{selectedEmail.leadId ?? "Not linked"}</span>
                </div>
              </div>

              {selectedEmail.logs.length ? (
                <div className={styles.logList}>
                  {selectedEmail.logs.map((log) => (
                    <div key={log.id} className={styles.logItem}>
                      <div className={styles.logTop}>
                        <span className={styles.label}>{log.event.replaceAll("_", " ")}</span>
                        <span className={styles.meta}>{formatDate(log.createdAt)}</span>
                      </div>
                      <p className={styles.copy}>
                        {log.message ?? `Attempt ${log.attemptNumber ?? "N/A"}`}
                      </p>
                      {log.attemptNumber ? (
                        <span className={styles.meta}>Attempt {log.attemptNumber}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.empty}>Delivery logs will appear here as the email moves through the queue.</p>
              )}

              {selectedEmail.variables ? (
                <div className={styles.jsonCard}>
                  <span className={styles.label}>Stored Variables</span>
                  <pre className={styles.json}>{JSON.stringify(selectedEmail.variables, null, 2)}</pre>
                </div>
              ) : null}

              {selectedEmail.providerResponse ? (
                <div className={styles.jsonCard}>
                  <span className={styles.label}>Provider Response</span>
                  <pre className={styles.json}>{JSON.stringify(selectedEmail.providerResponse, null, 2)}</pre>
                </div>
              ) : null}
            </div>
          ) : (
            <p className={styles.empty}>No email is selected yet.</p>
          )}
        </Surface>
      </div>
    </DashboardPage>
  )
}
