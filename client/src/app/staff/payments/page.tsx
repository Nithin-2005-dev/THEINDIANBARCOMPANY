"use client"

import { useMemo, useState } from "react"
import EmptyState from "@/components/admin/EmptyState"
import Panel from "@/components/admin/Panel"
import StatusBadge from "@/components/admin/StatusBadge"
import { useAdminResource } from "@/components/admin/useAdminResource"
import { formatCurrency, formatDateOnly } from "@/lib/admin-format"
import { canManageFinance } from "@/lib/roles"
import { staffApi } from "@/lib/staff-client"
import type { AdminUser } from "@/types/admin"

export default function StaffPaymentsPage() {
  const [status, setStatus] = useState("")
  const [refundAmountById, setRefundAmountById] = useState<Record<string, string>>({})
  const [refundReasonById, setRefundReasonById] = useState<Record<string, string>>({})

  const { data, error, isLoading, reload } = useAdminResource(async () => {
    const params = new URLSearchParams({ page: "1", limit: "100" })
    if (status) params.set("status", status)
    const [payments, me] = await Promise.all([staffApi.listPayments(params), staffApi.me()])
    return { payments, me: me as AdminUser }
  }, [status])

  const summary = useMemo(() => {
    if (!data) return null
    return {
      total: data.payments.items.reduce((sum, payment) => sum + payment.amount, 0),
      outstanding: data.payments.items
        .filter((payment) => payment.status === "PENDING")
        .reduce((sum, payment) => sum + payment.amount, 0),
      paid: data.payments.items
        .filter((payment) => payment.status === "PAID")
        .reduce((sum, payment) => sum + payment.amount, 0),
    }
  }, [data])

  if (isLoading) {
    return <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 text-white/65">Loading finance workspace...</div>
  }

  if (error || !data || !summary) {
    return <EmptyState title="Finance workspace unavailable" description={error ?? "Unable to load payments."} />
  }

  if (!canManageFinance(data.me.role)) {
    return <EmptyState title="Finance access required" description="Only finance or admin staff can access payment controls." />
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-[#d4af37]/80">Finance Workspace</p>
        <h1 className="mt-3 font-serif text-4xl text-white/95">Payments & Refunds</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/55">
          Monitor collections, review receipts, and process refunds without leaving the internal platform.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Panel title="Total Scheduled">
          <p className="font-serif text-3xl text-white/95">{formatCurrency(summary.total)}</p>
        </Panel>
        <Panel title="Outstanding">
          <p className="font-serif text-3xl text-[#f2d47f]">{formatCurrency(summary.outstanding)}</p>
        </Panel>
        <Panel title="Collected">
          <p className="font-serif text-3xl text-emerald-200/90">{formatCurrency(summary.paid)}</p>
        </Panel>
      </div>

      <Panel title="Payment Ledger" description="Milestones, receipts, and refund controls.">
        <div className="mb-5">
          <select
            className="min-h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All payment statuses</option>
            {["PENDING", "PAID", "FAILED", "REFUNDED"].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          {data.payments.items.length ? (
            data.payments.items.map((payment) => (
              <div key={payment.id} className="rounded-[24px] border border-white/8 bg-black/10 p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <p className="text-lg text-white/92">{payment.type} milestone</p>
                      <StatusBadge value={payment.status} />
                    </div>
                    <p className="mt-2 text-sm text-white/45">
                      {payment.project?.contract?.proposal?.title ?? payment.projectId}
                    </p>
                    <p className="mt-2 text-xs text-white/40">
                      Due {formatDateOnly(payment.dueDate)} | Ref {payment.transactionId ?? payment.gatewayOrderId ?? "Pending"}
                    </p>
                    {payment.receiptUrl ? (
                      <a
                        href={payment.receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex text-xs uppercase tracking-[0.18em] text-[#f2d47f]"
                      >
                        Download receipt
                      </a>
                    ) : null}
                  </div>

                  <div className="w-full max-w-sm space-y-3">
                    <p className="text-2xl text-[#f2d47f]">{formatCurrency(payment.amount)}</p>
                    {payment.status === "PAID" ? (
                      <>
                        <input
                          className="min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none"
                          placeholder="Refund amount (leave blank for full)"
                          value={refundAmountById[payment.id] ?? ""}
                          onChange={(event) =>
                            setRefundAmountById((current) => ({ ...current, [payment.id]: event.target.value }))
                          }
                        />
                        <input
                          className="min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none"
                          placeholder="Reason"
                          value={refundReasonById[payment.id] ?? ""}
                          onChange={(event) =>
                            setRefundReasonById((current) => ({ ...current, [payment.id]: event.target.value }))
                          }
                        />
                        <button
                          type="button"
                          className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-rose-400/25 bg-rose-400/10 px-4 text-xs uppercase tracking-[0.18em] text-rose-100"
                          onClick={async () => {
                            await staffApi.refundPayment(payment.id, {
                              amount: refundAmountById[payment.id] ? Number(refundAmountById[payment.id]) : undefined,
                              reason: refundReasonById[payment.id] || undefined,
                            })
                            setRefundAmountById((current) => ({ ...current, [payment.id]: "" }))
                            setRefundReasonById((current) => ({ ...current, [payment.id]: "" }))
                            await reload()
                          }}
                        >
                          Process Refund
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-white/55">No payments match the current filters.</p>
          )}
        </div>
      </Panel>
    </div>
  )
}
