"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import BookingWorkspaceHeader from "@/components/booking-workspace/BookingWorkspaceHeader/BookingWorkspaceHeader"
import EmptyState from "@/components/admin/EmptyState"
import Panel from "@/components/admin/Panel"
import StatusBadge from "@/components/admin/StatusBadge"
import { DashboardPage, MetricCard } from "@/components/dashboard/DashboardPrimitives"
import Button, { getButtonClassName } from "@/components/ui/Button/Button"
import { formatCurrency, formatDate, formatDateOnly } from "@/lib/admin-format"
import { staffApi } from "@/lib/staff-client"
import { uploadFileToPresignedUrl } from "@/lib/uploads"
import type { Lead, LeadStatus } from "@/types/admin"
import type { PortalEventDetailResponse } from "@/types/client-portal"
import styles from "./page.module.css"

const leadStatuses: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATING", "WON", "LOST"]

export default function StaffLeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [leadId, setLeadId] = useState("")
  const [lead, setLead] = useState<Lead | null>(null)
  const [thread, setThread] = useState<PortalEventDetailResponse["messages"]>([])
  const [note, setNote] = useState("")
  const [timelineEntry, setTimelineEntry] = useState("")
  const [messageBody, setMessageBody] = useState("")
  const [proposal, setProposal] = useState({ title: "", price: "", scope: "", deliverables: "", timeline: "", notes: "" })
  const [error, setError] = useState<string | null>(null)
  const [attachment, setAttachment] = useState<File | null>(null)

  const load = useCallback(async (id: string) => {
    try {
      const [nextLead, nextThread] = await Promise.all([
        staffApi.getLead(id),
        staffApi.getThread(id),
      ])
      setLead(nextLead)
      setThread(nextThread)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load lead.")
    }
  }, [])

  useEffect(() => {
    let active = true

    params.then(({ id }) => {
      if (!active) return
      setLeadId(id)
      void load(id)
    })
    return () => {
      active = false
    }
  }, [load, params])

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      let attachmentPayload: { attachmentName?: string; attachmentKey?: string; attachmentUrl?: string } = {}
      if (attachment) {
        const upload = await staffApi.createMessageUploadUrl(leadId, {
          fileName: attachment.name,
          contentType: attachment.type || "application/octet-stream",
          sizeBytes: attachment.size,
        })
        await uploadFileToPresignedUrl(upload.url, attachment)
        attachmentPayload = {
          attachmentName: attachment.name,
          attachmentKey: upload.key,
          attachmentUrl: upload.fileUrl,
        }
      }

      await staffApi.sendMessage(leadId, {
        body: messageBody,
        ...attachmentPayload,
      })
      setMessageBody("")
      setAttachment(null)
      await load(leadId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send message.")
    }
  }

  if (error && !lead) return <EmptyState title="Lead unavailable" description={error} />
  if (!lead) return <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 text-white/65">Loading lead...</div>

  const budgetRange = `${formatCurrency(lead.budgetMin)} to ${formatCurrency(lead.budgetMax)}`

  return (
    <DashboardPage>
      <BookingWorkspaceHeader
        actions={[
          { label: "Open chat", href: `/staff/chat?leadId=${lead.id}`, tone: "secondary" },
        ]}
        description={`${lead.location} on ${formatDateOnly(lead.eventDate)}.`}
        metaItems={[
          {
            label: "Client",
            value: lead.client.name ?? lead.client.phone ?? lead.client.email ?? "Assigned client",
          },
          { label: "Budget", value: budgetRange },
          { label: "Guests", value: lead.guestCount ? String(lead.guestCount) : "TBD" },
          { label: "Event date", value: formatDate(lead.eventDate) },
        ]}
        status={lead.status}
        title={lead.eventType}
      />

      <div className={styles.metricGrid}>
        <MetricCard label="Status" value={lead.status.replaceAll("_", " ")} hint="Current lifecycle stage." />
        <MetricCard label="Activities" value={lead.activities?.length ?? 0} hint="Logged follow-ups and team notes." />
        <MetricCard label="Messages" value={thread.length} hint="Messages attached to this booking." />
        <MetricCard label="Proposals" value={lead.proposals?.length ?? 0} hint="Commercial drafts built from this workspace." />
      </div>

      <div className="space-y-6">
      <Panel title={lead.eventType} description={`${lead.location} | ${formatDateOnly(lead.eventDate)}`}>
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div>
            <div className="flex items-center gap-3">
              <StatusBadge value={lead.status} />
              <p className="text-sm text-white/45">{lead.client.name ?? lead.client.phone ?? lead.client.email}</p>
            </div>
            <p className="mt-4 text-sm leading-7 text-white/58">{lead.notes || "No event notes shared yet."}</p>
            <p className="mt-4 text-xs text-white/45">Budget {formatCurrency(lead.budgetMin)} to {formatCurrency(lead.budgetMax)}</p>
          </div>
          <div className="grid gap-3">
            <select className="min-h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none" defaultValue={lead.status} onChange={async (event) => {
              await staffApi.updateLeadStatus(lead.id, event.target.value as LeadStatus)
              await load(lead.id)
            }}>
              {leadStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <textarea className="min-h-28 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" placeholder="Internal note" value={note} onChange={(event) => setNote(event.target.value)} />
            <Button type="button" onClick={async () => {
              await staffApi.createLeadNote(lead.id, note)
              setNote("")
              await load(lead.id)
            }}>Add note</Button>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel title="Proposal Builder" description="Assist the sales cycle without leaving the workspace.">
          <div className="grid gap-3">
            <input className="min-h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none" placeholder="Proposal title" value={proposal.title} onChange={(event) => setProposal((current) => ({ ...current, title: event.target.value }))} />
            <input className="min-h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none" placeholder="Price" value={proposal.price} onChange={(event) => setProposal((current) => ({ ...current, price: event.target.value }))} />
            <textarea className="min-h-24 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" placeholder="Scope" value={proposal.scope} onChange={(event) => setProposal((current) => ({ ...current, scope: event.target.value }))} />
            <textarea className="min-h-24 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" placeholder="Deliverables" value={proposal.deliverables} onChange={(event) => setProposal((current) => ({ ...current, deliverables: event.target.value }))} />
            <input className="min-h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none" placeholder="Timeline" value={proposal.timeline} onChange={(event) => setProposal((current) => ({ ...current, timeline: event.target.value }))} />
            <textarea className="min-h-20 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" placeholder="Notes" value={proposal.notes} onChange={(event) => setProposal((current) => ({ ...current, notes: event.target.value }))} />
            <Button type="button" variant="secondary" onClick={async () => {
              await staffApi.createProposal({
                leadId: lead.id,
                title: proposal.title,
                price: Number(proposal.price),
                scope: proposal.scope,
                deliverables: proposal.deliverables,
                timeline: proposal.timeline,
                notes: proposal.notes || undefined,
              })
              setProposal({ title: "", price: "", scope: "", deliverables: "", timeline: "", notes: "" })
              await load(lead.id)
            }}>Create proposal</Button>
          </div>
        </Panel>

        <Panel title="Follow-up Timeline" description="Log manual actions and keep context persistent.">
          <div className="grid gap-3">
            <textarea className="min-h-24 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" placeholder="Add a follow-up note or activity" value={timelineEntry} onChange={(event) => setTimelineEntry(event.target.value)} />
            <Button type="button" variant="secondary" onClick={async () => {
              await staffApi.addLeadActivity(lead.id, timelineEntry)
              setTimelineEntry("")
              await load(lead.id)
            }}>Log activity</Button>
            <div className="space-y-3">
              {lead.activities?.map((activity) => (
                <div key={activity.id} className="rounded-[20px] border border-white/8 bg-black/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-white/90">{activity.description}</p>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">{formatDate(activity.createdAt)}</p>
                  </div>
                </div>
              )) ?? <p className="text-sm text-white/55">No timeline entries yet.</p>}
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Client Thread" description="Project-specific conversation with real file uploads.">
        <div className="space-y-3">
          {thread.map((message) => (
            <div key={message.id} className="rounded-[20px] border border-white/8 bg-black/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-white/90">{message.sender?.name || "System"}</p>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">{formatDate(message.createdAt)}</p>
              </div>
              <p className="mt-3 text-sm leading-7 text-white/62">{message.body}</p>
              {message.attachmentUrl ? (
                <a
                  href={message.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`${getButtonClassName({ variant: "ghost" })} mt-3`}
                >
                  {message.attachmentName || "Open attachment"}
                </a>
              ) : null}
            </div>
          ))}
        </div>
        <form className="mt-5 grid gap-3" onSubmit={sendMessage}>
          <textarea className="min-h-28 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" placeholder="Send a message to the client" value={messageBody} onChange={(event) => setMessageBody(event.target.value)} />
          <input type="file" className="text-sm text-white/70" onChange={(event) => setAttachment(event.target.files?.[0] ?? null)} />
          <Button type="submit">Send message</Button>
        </form>
      </Panel>
      </div>
    </DashboardPage>
  )
}
