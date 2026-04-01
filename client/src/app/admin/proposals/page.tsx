"use client"

import { useState } from "react"
import AdminPageHeader from "@/components/admin/AdminPageHeader"
import EmptyState from "@/components/admin/EmptyState"
import Panel from "@/components/admin/Panel"
import StatusBadge from "@/components/admin/StatusBadge"
import { useAdminResource } from "@/components/admin/useAdminResource"
import { adminApi } from "@/lib/admin-client"
import { formatCurrency, formatDate } from "@/lib/admin-format"
import type { ProposalStatus } from "@/types/admin"

const proposalStatuses: ProposalStatus[] = ["DRAFT", "SENT", "ACCEPTED", "REJECTED"]

export default function AdminProposalsPage() {
  const [status, setStatus] = useState("")
  const { data, error, isLoading } = useAdminResource(async () => {
    const params = new URLSearchParams({ page: "1", limit: "20" })
    if (status) params.set("status", status)
    return adminApi.listProposals(params)
  }, [status])

  if (isLoading) return <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 text-white/65">Loading proposals...</div>
  if (error || !data) return <EmptyState title="Proposals unavailable" description={error ?? "Unable to load proposals."} />
  if (data.items.length === 0) {
    return (
      <div>
        <AdminPageHeader title="Proposals" description="Track draft, sent, accepted, and rejected commercial proposals." />
        <Panel>
          <EmptyState
            title="No proposals created yet"
            description="Client booking requests first appear in Bookings. A proposal will show here only after an admin opens the booking lead and creates the first commercial proposal."
          />
        </Panel>
      </div>
    )
  }

  return (
    <div>
      <AdminPageHeader title="Proposals" description="Track draft, sent, accepted, and rejected commercial proposals." />
      <Panel>
        <div className="mb-5 flex justify-end">
          <select className="min-h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All proposal statuses</option>
            {proposalStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {data.items.map((proposal) => (
            <article key={proposal.id} className="rounded-[24px] border border-white/8 bg-black/10 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg text-white/92">{proposal.title}</h3>
                  <p className="mt-1 text-sm text-white/45">Lead: {proposal.lead?.eventType ?? proposal.leadId}</p>
                </div>
                <StatusBadge value={proposal.status} />
              </div>
              <p className="mt-4 text-xl font-medium text-[#f3e8bf]">{formatCurrency(proposal.price)}</p>
              <p className="mt-3 text-sm leading-7 text-white/55">{proposal.scope}</p>
              <div className="mt-4 grid gap-2 text-xs text-white/45">
                <p>Timeline: {proposal.timeline}</p>
                <p>Created: {formatDate(proposal.createdAt)}</p>
                <p>Contract: {proposal.contract ? proposal.contract.status : "Not created"}</p>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  )
}
