"use client"

import { FormEvent, useMemo, useState } from "react"
import StatusBadge from "@/components/admin/StatusBadge"
import { useAdminResource } from "@/components/admin/useAdminResource"
import {
  DashboardButton,
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
import { ModalDialog } from "@/components/dashboard/ModalDialog"
import { useToast } from "@/components/dashboard/ToastProvider"
import { VirtualizedList } from "@/components/dashboard/VirtualizedList"
import { adminApi } from "@/lib/admin-client"
import {
  formatCurrency,
  formatDate,
  formatDateOnly,
  formatRelativeDate,
} from "@/lib/admin-format"
import { useAssistantPageState } from "@/lib/assistant-page-state"
import type { Payment, PaymentStatus, PaymentType, Project } from "@/types/admin"
import styles from "./page.module.css"

const paymentStatuses: PaymentStatus[] = ["PENDING", "PAID", "FAILED", "REFUNDED"]
const editablePaymentStatuses: Array<Exclude<PaymentStatus, "REFUNDED">> = ["PENDING", "PAID", "FAILED"]
const paymentTypes: PaymentType[] = ["ADVANCE", "MID", "FINAL"]

function isOverdue(payment: Payment) {
  if (!payment.dueDate || payment.status !== "PENDING") return false
  return new Date(payment.dueDate).getTime() < Date.now()
}

function getProjectLabel(project?: Project | null) {
  return project?.contract?.proposal?.title ?? `Project ${project?.id.slice(0, 8) ?? ""}`
}

function PaymentCard({
  payment,
  project,
  onCreateOrder,
  onRequestStatusChange,
  onRequestRefund,
}: {
  payment: Payment
  project?: Project
  onCreateOrder: (payment: Payment) => Promise<void>
  onRequestStatusChange: (payment: Payment, nextStatus: PaymentStatus) => void
  onRequestRefund: (payment: Payment) => void
}) {
  const overdue = isOverdue(payment)

  return (
    <article className="rounded-[26px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] p-5">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--dashboard-text)]">
                {payment.type} milestone
              </h3>
              <StatusBadge value={payment.status} />
              {overdue ? <div className={styles.softPill}>Overdue</div> : null}
            </div>
            <p className="mt-2 text-sm text-[var(--dashboard-muted)]">
              {getProjectLabel(project)}
            </p>
            <p className="mt-1 text-sm text-[var(--dashboard-muted)]">
              {project?.contract?.proposal?.lead?.eventType ?? "Confirmed event"} at{" "}
              {project?.contract?.proposal?.lead?.location ?? "TBD"}
            </p>
          </div>
          <div className="text-left lg:text-right">
            <p className="text-2xl font-semibold tracking-[-0.03em] text-[var(--dashboard-text)]">
              {formatCurrency(payment.amount)}
            </p>
            <p className="mt-2 text-sm text-[var(--dashboard-muted)]">
              Due {formatDateOnly(payment.dueDate)}
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[20px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.03)] p-4">
            <p className={styles.eyebrow}>Client</p>
            <p className="mt-2 text-sm font-medium text-[var(--dashboard-text)]">
              {project?.client?.name ?? project?.client?.email ?? project?.client?.phone ?? "Client"}
            </p>
          </div>
          <div className="rounded-[20px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.03)] p-4">
            <p className={styles.eyebrow}>Gateway</p>
            <p className="mt-2 text-sm font-medium text-[var(--dashboard-text)]">
              {payment.gateway ?? "RAZORPAY"}
            </p>
            <p className="mt-1 text-xs text-[var(--dashboard-muted)]">
              {payment.gatewayOrderId ?? "Order not created yet"}
            </p>
          </div>
          <div className="rounded-[20px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.03)] p-4">
            <p className={styles.eyebrow}>Transaction</p>
            <p className="mt-2 text-sm font-medium text-[var(--dashboard-text)]">
              {payment.transactionId ?? "Awaiting capture"}
            </p>
          </div>
          <div className="rounded-[20px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.03)] p-4">
            <p className={styles.eyebrow}>Updated</p>
            <p className="mt-2 text-sm font-medium text-[var(--dashboard-text)]">
              {formatRelativeDate(payment.updatedAt)}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-[22px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.03)] p-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--dashboard-text)]">
              {payment.status === "PAID"
                ? `Paid ${payment.paidAt ? formatDate(payment.paidAt) : "recently"}`
                : payment.gatewayOrderId
                  ? "Gateway order ready for checkout"
                  : "Client checkout order still needs to be generated"}
            </p>
            <p className="mt-1 text-sm text-[var(--dashboard-muted)]">
              {payment.notes || "Client can pay this milestone from the portal once the gateway order exists."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {payment.status === "PENDING" && !payment.gatewayOrderId ? (
              <button
                type="button"
                onClick={() => void onCreateOrder(payment)}
                className={`${styles.secondaryButton} inline-flex min-h-11 items-center rounded-full px-4 text-sm`}
              >
                Generate Razorpay order
              </button>
            ) : null}
            {payment.receiptUrl ? (
              <a
                href={payment.receiptUrl}
                className={`${styles.secondaryButton} inline-flex min-h-11 items-center rounded-full px-4 text-sm`}
              >
                Open receipt
              </a>
            ) : null}
            {payment.status === "PAID" && payment.transactionId ? (
              <button
                type="button"
                onClick={() => onRequestRefund(payment)}
                className={`${styles.secondaryButton} inline-flex min-h-11 items-center rounded-full px-4 text-sm`}
              >
                Refund
              </button>
            ) : null}
            {payment.status !== "REFUNDED" ? (
              <select
                className="min-h-11 rounded-[16px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] px-4 text-sm text-[var(--dashboard-text)] outline-none"
                value={payment.status}
                onChange={(event) =>
                  onRequestStatusChange(payment, event.target.value as PaymentStatus)
                }
              >
                {editablePaymentStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}

export default function AdminPaymentsPage() {
  const { pushToast } = useToast()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState("")
  const [type, setType] = useState("")
  const [projectId, setProjectId] = useState("")
  const [form, setForm] = useState({
    projectId: "",
    type: "ADVANCE" as PaymentType,
    amount: "",
    dueDate: "",
    notes: "",
  })
  const [isCreating, setIsCreating] = useState(false)
  const [isMutatingPayment, setIsMutatingPayment] = useState(false)
  const [statusDialog, setStatusDialog] = useState<{
    payment: Payment
    nextStatus: Exclude<PaymentStatus, "REFUNDED">
    transactionId: string
  } | null>(null)
  const [refundDialog, setRefundDialog] = useState<{
    payment: Payment
    reason: string
  } | null>(null)

  const { data, error, isLoading, isRefreshing, reload } = useAdminResource(async () => {
    const paymentParams = new URLSearchParams({ page: String(page), limit: "20" })
    if (status) paymentParams.set("status", status)
    if (type) paymentParams.set("type", type)
    if (projectId) paymentParams.set("projectId", projectId)

    const [payments, projects] = await Promise.all([
      adminApi.listPayments(paymentParams),
      adminApi.listProjects(new URLSearchParams({ page: "1", limit: "100" })),
    ])

    return {
      payments,
      projects: projects.items,
    }
  }, [page, projectId, status, type], {
    refreshIntervalMs: 30000,
  })

  const projectMap = useMemo(
    () => new Map((data?.projects ?? []).map((project) => [project.id, project])),
    [data?.projects],
  )

  const metrics = useMemo(() => {
    const payments = data?.payments.items ?? []

    return {
      scheduled: payments.reduce((sum, payment) => sum + payment.amount, 0),
      pending: payments
        .filter((payment) => payment.status === "PENDING")
        .reduce((sum, payment) => sum + payment.amount, 0),
      paid: payments
        .filter((payment) => payment.status === "PAID")
        .reduce((sum, payment) => sum + payment.amount, 0),
      overdueCount: payments.filter((payment) => isOverdue(payment)).length,
    }
  }, [data?.payments.items])

  useAssistantPageState({
    currentTab: "payments",
    currentView: "admin-payments",
    selectedProjectId: projectId || null,
    overduePaymentCount: metrics.overdueCount,
    pendingPaymentCount: data?.payments.items.filter((payment) => payment.status === "PENDING").length ?? 0,
    paidPaymentCount: data?.payments.items.filter((payment) => payment.status === "PAID").length ?? 0,
    filters: {
      status: status || null,
      type: type || null,
      projectId: projectId || null,
      page,
    },
  })

  const handleCreatePayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!form.projectId || !form.amount.trim()) {
      pushToast({
        title: "Missing milestone details",
        description: "Select the project and amount before scheduling a payment.",
        tone: "error",
      })
      return
    }

    setIsCreating(true)
    try {
      await adminApi.createPayment({
        projectId: form.projectId,
        type: form.type,
        amount: Number(form.amount),
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
        notes: form.notes || undefined,
      })
      setForm({
        projectId: "",
        type: "ADVANCE",
        amount: "",
        dueDate: "",
        notes: "",
      })
      pushToast({
        title: "Payment scheduled",
        description: "The milestone is now visible in the client portal.",
        tone: "success",
      })
      await reload()
    } catch (createError) {
      pushToast({
        title: "Unable to create payment",
        description: createError instanceof Error ? createError.message : "Please try again.",
        tone: "error",
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleCreateOrder = async (payment: Payment) => {
    try {
      await adminApi.createPaymentOrder(payment.id, payment.id)
      pushToast({
        title: "Razorpay order created",
        description: "The client can now complete this milestone in test mode checkout.",
        tone: "success",
      })
      await reload()
    } catch (orderError) {
      pushToast({
        title: "Unable to create order",
        description: orderError instanceof Error ? orderError.message : "Please try again.",
        tone: "error",
      })
    }
  }

  const requestStatusChange = (payment: Payment, nextStatus: PaymentStatus) => {
    if (payment.status === nextStatus) {
      return
    }

    if (nextStatus === "REFUNDED") {
      return
    }

    setStatusDialog({
      payment,
      nextStatus,
      transactionId: payment.transactionId ?? "",
    })
  }

  const handleUpdateStatus = async () => {
    if (!statusDialog) return

    setIsMutatingPayment(true)
    try {
      await adminApi.updatePaymentStatus(statusDialog.payment.id, {
        status: statusDialog.nextStatus,
        transactionId: statusDialog.transactionId.trim() || undefined,
      })
      pushToast({
        title: "Payment updated",
        description: `Status changed to ${statusDialog.nextStatus.replaceAll("_", " ")}.`,
        tone: "success",
        actionLabel: "Undo",
        onAction: async () => {
          await adminApi.updatePaymentStatus(statusDialog.payment.id, {
            status: statusDialog.payment.status,
            transactionId: statusDialog.payment.transactionId ?? undefined,
          })
          pushToast({
            title: "Payment restored",
            description: `Status moved back to ${statusDialog.payment.status.replaceAll("_", " ")}.`,
            tone: "success",
          })
          await reload()
        },
      })
      setStatusDialog(null)
      await reload()
    } catch (updateError) {
      pushToast({
        title: "Unable to update payment",
        description: updateError instanceof Error ? updateError.message : "Please try again.",
        tone: "error",
      })
    } finally {
      setIsMutatingPayment(false)
    }
  }

  const requestRefund = (payment: Payment) => {
    setRefundDialog({
      payment,
      reason: payment.notes ?? "",
    })
  }

  const handleRefund = async () => {
    if (!refundDialog) return

    setIsMutatingPayment(true)
    try {
      await adminApi.refundPayment(refundDialog.payment.id, {
        reason: refundDialog.reason.trim() || undefined,
      })
      pushToast({
        title: "Refund initiated",
        description: "The payment has been marked for refund and client notifications will follow.",
        tone: "success",
      })
      setRefundDialog(null)
      await reload()
    } catch (refundError) {
      pushToast({
        title: "Unable to refund payment",
        description: refundError instanceof Error ? refundError.message : "Please try again.",
        tone: "error",
      })
    } finally {
      setIsMutatingPayment(false)
    }
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
        title="Payments unavailable"
        description={error ?? "Unable to load payment operations."}
      />
    )
  }

  return (
    <>
      <DashboardPage>
        <PageHero
          eyebrow="Payments"
          title="Schedule milestones, prepare checkout, and keep cash collection visible."
          description="Create deposit and staged payment requests directly from projects, prepare Razorpay test orders, and monitor capture, failure, or refund state without leaving finance operations."
          action={{ label: "Open Projects", href: "/admin/projects" }}
          secondaryAction={{ label: "Open Contracts", href: "/admin/contracts" }}
        />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Scheduled Value" value={formatCurrency(metrics.scheduled)} hint="Visible payments in the current view." />
        <MetricCard label="Pending Dues" value={formatCurrency(metrics.pending)} hint="Milestones still awaiting collection." />
        <MetricCard label="Collected" value={formatCurrency(metrics.paid)} hint="Payments already captured." />
        <MetricCard label="Overdue Count" value={metrics.overdueCount} hint="Pending dues past their due date." />
      </div>

      {error ? (
        <InlineNotice
          tone="warning"
          title="Showing the last successful payment data"
          description={`${error} Finance operations can continue from the cached view while the next background refresh reconnects.`}
        />
      ) : null}

        <div className="grid gap-6 2xl:grid-cols-[0.82fr_1.18fr]">
          <Surface
            title="Create Payment Milestone"
            description="Schedule advance, mid-event, or final collections. The client sees the milestone immediately in their booking workspace."
          >
          <form className="space-y-4" onSubmit={handleCreatePayment}>
            <label className="grid gap-2 text-sm text-[var(--dashboard-muted)]">
              Project
              <select
                className="min-h-12 rounded-[18px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] px-4 text-sm text-[var(--dashboard-text)] outline-none"
                value={form.projectId}
                onChange={(event) => setForm((current) => ({ ...current, projectId: event.target.value }))}
              >
                <option value="">Choose a project</option>
                {data.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {getProjectLabel(project)} | {project.contract?.proposal?.lead?.eventType ?? project.id}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm text-[var(--dashboard-muted)]">
                Milestone type
                <select
                  className="min-h-12 rounded-[18px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] px-4 text-sm text-[var(--dashboard-text)] outline-none"
                  value={form.type}
                  onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as PaymentType }))}
                >
                  {paymentTypes.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm text-[var(--dashboard-muted)]">
                Amount (INR)
                <input
                  value={form.amount}
                  onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                  placeholder="75000"
                  className="min-h-12 rounded-[18px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] px-4 text-sm text-[var(--dashboard-text)] outline-none"
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm text-[var(--dashboard-muted)]">
              Due date
              <input
                type="date"
                value={form.dueDate}
                onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                className="min-h-12 rounded-[18px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] px-4 text-sm text-[var(--dashboard-text)] outline-none"
              />
            </label>

            <label className="grid gap-2 text-sm text-[var(--dashboard-muted)]">
              Notes
              <textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Optional collection notes or receipt context"
                className="min-h-28 rounded-[18px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--dashboard-text)] outline-none"
              />
            </label>

            <div className="rounded-[20px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.03)] p-4 text-sm text-[var(--dashboard-muted)]">
              Typical order is advance, mid, then final. Duplicate active milestones of the same type are blocked by the backend.
            </div>

            <DashboardButton type="submit" disabled={isCreating}>
              {isCreating ? "Scheduling..." : "Schedule Payment"}
            </DashboardButton>
          </form>
        </Surface>

        <Surface
          title="Payment Operations"
          description="Filter scheduled milestones, generate checkout orders, track payment references, and manage refund outcomes."
          headerAction={
            <div className="flex flex-wrap items-center gap-3">
              {isRefreshing ? <div className={styles.softPill}>Refreshing</div> : null}
              <select
                className="min-h-11 rounded-[16px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] px-4 text-sm text-[var(--dashboard-text)] outline-none"
                value={projectId}
                onChange={(event) => {
                  setPage(1)
                  setProjectId(event.target.value)
                }}
              >
                <option value="">All projects</option>
                {data.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {getProjectLabel(project)}
                  </option>
                ))}
              </select>
              <select
                className="min-h-11 rounded-[16px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] px-4 text-sm text-[var(--dashboard-text)] outline-none"
                value={type}
                onChange={(event) => {
                  setPage(1)
                  setType(event.target.value)
                }}
              >
                <option value="">All types</option>
                {paymentTypes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select
                className="min-h-11 rounded-[16px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] px-4 text-sm text-[var(--dashboard-text)] outline-none"
                value={status}
                onChange={(event) => {
                  setPage(1)
                  setStatus(event.target.value)
                }}
              >
                <option value="">All statuses</option>
                {paymentStatuses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          }
        >
          {data.payments.items.length ? (
            <VirtualizedList
              items={data.payments.items}
              itemHeight={320}
              height={Math.min(920, Math.max(360, data.payments.items.length * 320))}
              overscan={3}
              contentClassName="space-y-4"
              getKey={(payment) => payment.id}
              ariaLabel="Payment operations list"
              renderItem={(payment) => (
                <PaymentCard
                  payment={payment}
                  project={projectMap.get(payment.projectId)}
                  onCreateOrder={handleCreateOrder}
                  onRequestRefund={requestRefund}
                  onRequestStatusChange={requestStatusChange}
                />
              )}
            />
          ) : (
            <EmptyState
              title="No payments match this view"
              description="Clear a filter or schedule the first milestone from a confirmed project."
            />
          )}

          <div className="mt-6 flex flex-col gap-4 text-sm text-[var(--dashboard-muted)] sm:flex-row sm:items-center sm:justify-between">
            <p>
              Showing {data.payments.items.length} of {data.payments.meta.total} payment records
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className={`${styles.secondaryButton} inline-flex min-h-10 items-center rounded-full px-4 text-sm`}
              >
                Previous
              </button>
              <span>Page {data.payments.meta.page}</span>
              <button
                type="button"
                disabled={page * data.payments.meta.limit >= data.payments.meta.total}
                onClick={() => setPage((current) => current + 1)}
                className={`${styles.secondaryButton} inline-flex min-h-10 items-center rounded-full px-4 text-sm`}
              >
                Next
              </button>
            </div>
          </div>
          </Surface>
        </div>
      </DashboardPage>

      <ModalDialog
        open={Boolean(statusDialog)}
        onClose={() => setStatusDialog(null)}
        title="Update payment status"
        description="Confirm the payment status change and record any manual transaction reference if the settlement happened outside the webhook flow."
        widthClassName="max-w-xl"
        tone={statusDialog?.nextStatus === "FAILED" ? "danger" : "default"}
        closeDisabled={isMutatingPayment}
        footer={
          <>
            <DashboardButton tone="secondary" onClick={() => setStatusDialog(null)} disabled={isMutatingPayment}>
              Cancel
            </DashboardButton>
            <DashboardButton
              tone={statusDialog?.nextStatus === "FAILED" ? "danger" : "primary"}
              onClick={() => void handleUpdateStatus()}
              disabled={isMutatingPayment}
            >
              {isMutatingPayment ? "Saving..." : "Save status"}
            </DashboardButton>
          </>
        }
      >
        {statusDialog ? (
          <div className="space-y-4">
            <div className="rounded-[20px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.03)] p-4 text-sm text-[var(--dashboard-muted)]">
              {statusDialog.payment.type} milestone for {getProjectLabel(projectMap.get(statusDialog.payment.projectId))} will move to{" "}
              <span className="font-medium text-[var(--dashboard-text)]">{statusDialog.nextStatus}</span>.
            </div>
            {statusDialog.nextStatus === "PAID" ? (
              <label className="grid gap-2 text-sm text-[var(--dashboard-muted)]">
                Manual transaction reference
                <input
                  value={statusDialog.transactionId}
                  onChange={(event) =>
                    setStatusDialog((current) =>
                      current
                        ? {
                            ...current,
                            transactionId: event.target.value,
                          }
                        : current,
                    )
                  }
                  placeholder="Optional settlement or bank reference"
                  className="min-h-12 rounded-[18px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] px-4 text-sm text-[var(--dashboard-text)] outline-none"
                />
              </label>
            ) : null}
          </div>
        ) : null}
      </ModalDialog>

      <ModalDialog
        open={Boolean(refundDialog)}
        onClose={() => setRefundDialog(null)}
        title="Refund payment"
        description="This will attempt a Razorpay refund and preserve the reason on the payment record for audit visibility."
        widthClassName="max-w-xl"
        tone="danger"
        closeDisabled={isMutatingPayment}
        footer={
          <>
            <DashboardButton tone="secondary" onClick={() => setRefundDialog(null)} disabled={isMutatingPayment}>
              Cancel
            </DashboardButton>
            <DashboardButton tone="danger" onClick={() => void handleRefund()} disabled={isMutatingPayment}>
              {isMutatingPayment ? "Refunding..." : "Confirm refund"}
            </DashboardButton>
          </>
        }
      >
        {refundDialog ? (
          <div className="space-y-4">
            <div className="rounded-[20px] border border-amber-400/18 bg-amber-400/8 p-4 text-sm leading-7 text-[var(--dashboard-muted)]">
              Refund {formatCurrency(refundDialog.payment.amount)} from the {refundDialog.payment.type.toLowerCase()} milestone. Use a precise reason so finance and support can trace the decision later.
            </div>
            <label className="grid gap-2 text-sm text-[var(--dashboard-muted)]">
              Refund reason
              <textarea
                value={refundDialog.reason}
                onChange={(event) =>
                  setRefundDialog((current) =>
                    current
                      ? {
                          ...current,
                          reason: event.target.value,
                        }
                      : current,
                  )
                }
                className="min-h-24 rounded-[18px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--dashboard-text)] outline-none"
              />
            </label>
          </div>
        ) : null}
      </ModalDialog>
    </>
  )
}
