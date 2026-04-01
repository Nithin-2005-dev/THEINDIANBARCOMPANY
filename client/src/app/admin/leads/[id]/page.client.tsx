"use client"

import { FormEvent, useState } from "react"
import Link from "next/link"
import BookingWorkspaceHeader from "@/components/booking-workspace/BookingWorkspaceHeader/BookingWorkspaceHeader"
import EmptyState from "@/components/admin/EmptyState"
import Panel from "@/components/admin/Panel"
import StatusBadge from "@/components/admin/StatusBadge"
import {
  DashboardPage,
  MetricCard,
} from "@/components/dashboard/DashboardPrimitives"
import Button, { getButtonClassName } from "@/components/ui/Button/Button"
import { useAdminResource } from "@/components/admin/useAdminResource"
import { adminApi } from "@/lib/admin-client"
import { formatCurrency, formatDate, formatRelativeDate } from "@/lib/admin-format"
import { uploadFileToPresignedUrl } from "@/lib/uploads"
import type { LeadStatus } from "@/types/admin"
import type { PortalEventDetailResponse } from "@/types/client-portal"
import styles from "./page.module.css"

const statuses: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATING", "WON", "LOST"]

function getLeadNextAction(lead: {
  status: LeadStatus
  proposals?: Array<{ status: string; contract?: { id: string } | null }>
}) {
  const proposalStatuses = lead.proposals?.map((proposal) => proposal.status) ?? []
  const hasProposal = proposalStatuses.length > 0
  const acceptedProposal = lead.proposals?.find((proposal) => proposal.status === "ACCEPTED")
  const sentProposal = lead.proposals?.find((proposal) => proposal.status === "SENT")
  const contract = lead.proposals?.find((proposal) => proposal.contract)?.contract

  if (lead.status === "NEW") return "Review the booking, assign ownership, and make first contact."
  if (lead.status === "CONTACTED") return "Confirm fit, budget, and event details before marking the lead qualified."
  if (lead.status === "QUALIFIED") return "Prepare the commercial proposal and send the first offer."
  if (lead.status === "PROPOSAL_SENT") return "Follow up on the sent proposal and capture the client decision."
  if (lead.status === "NEGOTIATING" && !hasProposal) return "Create the first commercial proposal."
  if (lead.status === "NEGOTIATING" && sentProposal) return "Revise commercials, send the next proposal version, and keep the conversation moving."
  if (acceptedProposal && !contract) return "Create and issue the contract from the accepted proposal."
  if (contract) return "Track signature completion, then hand off into projects and payments."
  if (lead.status === "WON") return "Confirm the accepted proposal and push the contract stage forward."
  if (lead.status === "LOST") return "Archive learnings or reopen only if the client re-engages."
  return "Advance the booking through proposal, contract, project, and payment stages."
}

function getStatusActionLabel(status: LeadStatus) {
  if (status === "CONTACTED") return "Mark Contacted"
  if (status === "QUALIFIED") return "Mark Qualified"
  if (status === "PROPOSAL_SENT") return "Mark Proposal Sent"
  return status.replaceAll("_", " ")
}

export default function LeadDetailClient({ id }: { id: string }) {
  const [proposalForm, setProposalForm] = useState({ title: "", price: "", scope: "", deliverables: "", timeline: "", notes: "" })
  const [noteContent, setNoteContent] = useState("")
  const [manualActivity, setManualActivity] = useState("")
  const [assignmentUserId, setAssignmentUserId] = useState("")
  const [assignmentRole, setAssignmentRole] = useState<"PRIMARY" | "SUPPORTING">("PRIMARY")
  const [messageBody, setMessageBody] = useState("")
  const [messageAttachment, setMessageAttachment] = useState<File | null>(null)

  const { data, error, isLoading, reload } = useAdminResource(async () => {
    const [lead, notes, timeline, statusHistory, assignments, users, thread] = await Promise.all([
      adminApi.getLead(id),
      adminApi.listLeadNotes(id),
      adminApi.listLeadTimeline(id),
      adminApi.listLeadStatusHistory(id),
      adminApi.listLeadAssignments(id),
      adminApi.listUsers(new URLSearchParams({ page: "1", limit: "100" })),
      adminApi.getLeadThread(id),
    ])

    return { lead, notes, timeline, statusHistory, assignments, users, thread: thread as PortalEventDetailResponse["messages"] }
  }, [id])

  const changeStatus = async (status: LeadStatus) => {
    await adminApi.updateLeadStatus(id, status)
    await reload()
  }

  const createProposal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await adminApi.createProposal({
      leadId: id,
      title: proposalForm.title,
      price: Number(proposalForm.price),
      scope: proposalForm.scope,
      deliverables: proposalForm.deliverables,
      timeline: proposalForm.timeline,
      notes: proposalForm.notes || undefined,
      status: "SENT",
    })
    setProposalForm({ title: "", price: "", scope: "", deliverables: "", timeline: "", notes: "" })
    await reload()
  }

  const addNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await adminApi.createLeadNote(id, noteContent)
    setNoteContent("")
    await reload()
  }

  const addManualTimeline = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await adminApi.addLeadTimelineEntry(id, manualActivity)
    setManualActivity("")
    await reload()
  }

  const assignStaff = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!assignmentUserId) return
    await adminApi.assignLeadStaff(id, { userId: assignmentUserId, role: assignmentRole })
    setAssignmentUserId("")
    await reload()
  }

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    let attachmentPayload: { attachmentName?: string; attachmentKey?: string; attachmentUrl?: string } = {}

    if (messageAttachment) {
      const upload = await adminApi.createLeadMessageUploadUrl(id, {
        fileName: messageAttachment.name,
        contentType: messageAttachment.type || "application/octet-stream",
        sizeBytes: messageAttachment.size,
      })
      await uploadFileToPresignedUrl(upload.url, messageAttachment)
      attachmentPayload = {
        attachmentName: messageAttachment.name,
        attachmentKey: upload.key,
        attachmentUrl: upload.fileUrl,
      }
    }

    await adminApi.sendLeadMessage(id, {
      body: messageBody,
      ...attachmentPayload,
    })
    setMessageBody("")
    setMessageAttachment(null)
    await reload()
  }

  if (isLoading) return <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 text-white/65">Loading lead...</div>
  if (error || !data) return <EmptyState title="Lead unavailable" description={error ?? "Unable to load this lead."} />

  const { lead, notes, timeline, statusHistory, assignments, users, thread } = data
  const acceptedProposal = lead.proposals?.find((proposal) => proposal.status === "ACCEPTED")
  const activeContract = lead.proposals?.find((proposal) => proposal.contract)?.contract ?? null
  const activeAssignments = assignments.filter((assignment) => assignment.isActive)
  const budgetRange = `${formatCurrency(lead.budgetMin)} - ${formatCurrency(lead.budgetMax)}`

  return (
    <DashboardPage>
      <BookingWorkspaceHeader
        actions={[
          ...(acceptedProposal && !activeContract
            ? [{ label: "Issue contract", href: "/admin/contracts", tone: "primary" as const }]
            : []),
          ...(activeContract
            ? [
                { label: "Open projects", href: "/admin/projects", tone: "secondary" as const },
                { label: "Open payments", href: "/admin/payments", tone: "ghost" as const },
              ]
            : []),
          { label: "Open chat", href: `/admin/chat?leadId=${lead.id}`, tone: "secondary" },
        ]}
        description={`Client enquiry from ${lead.client.name ?? lead.client.phone ?? "the client"} for ${lead.location}.`}
        metaItems={[
          { label: "Event date", value: formatDate(lead.eventDate) },
          { label: "Budget", value: budgetRange },
          { label: "Guests", value: lead.guestCount ? String(lead.guestCount) : "TBD" },
          { label: "Assigned team", value: activeAssignments.length ? `${activeAssignments.length} active` : "Unassigned" },
        ]}
        status={lead.status}
        title={lead.eventType}
      />

      <div className={styles.metricGrid}>
        <MetricCard label="Client" value={lead.client.name ?? "Unnamed"} hint={lead.client.phone ?? lead.client.email ?? "Contact not shared"} />
        <MetricCard label="Status" value={lead.status.replaceAll("_", " ")} hint="Current lifecycle stage." />
        <MetricCard label="Proposals" value={lead.proposals?.length ?? 0} hint="Commercial versions created so far." />
        <MetricCard label="Assignments" value={activeAssignments.length} hint="Active staff coverage on this booking." />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Lead Overview">
          <div className="grid gap-4 text-sm text-white/60">
            <div className="flex items-center justify-between gap-3"><span>Status</span><StatusBadge value={lead.status} /></div>
            <div className="flex items-center justify-between gap-3"><span>Client</span><span>{lead.client.name ?? "Unnamed"} | {lead.client.phone ?? "No phone"}</span></div>
            <div className="flex items-center justify-between gap-3"><span>Email</span><span>{lead.client.email ?? "-"}</span></div>
            <div className="flex items-center justify-between gap-3"><span>Event date</span><span>{formatDate(lead.eventDate)}</span></div>
            <div className="flex items-center justify-between gap-3"><span>Guest count</span><span>{lead.guestCount ?? "-"}</span></div>
            <div className="flex items-center justify-between gap-3"><span>Budget</span><span>{formatCurrency(lead.budgetMin)} - {formatCurrency(lead.budgetMax)}</span></div>
            <div><p className="mb-2 text-white/85">Notes</p><div className="rounded-[22px] border border-white/8 bg-black/10 p-4 leading-7 text-white/55">{lead.notes ?? "No notes provided."}</div></div>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Lifecycle" description="Keep the booking-to-project journey explicit for the team.">
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                { label: "Lead", complete: true },
                { label: "Proposal", complete: Boolean(lead.proposals?.length) },
                { label: "Contract", complete: Boolean(activeContract) },
                { label: "Project handoff", complete: lead.status === "WON" && Boolean(activeContract) },
              ].map((step, index) => (
                <div
                  key={step.label}
                  className={`rounded-[18px] border px-3 py-3 text-sm ${
                    step.complete
                      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
                      : "border-white/8 bg-black/10 text-white/45"
                  }`}
                >
                  <p className={styles.eyebrow}>Step {index + 1}</p>
                  <p className="mt-2 font-medium">{step.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-[22px] border border-white/8 bg-black/10 p-4">
              <p className="text-sm font-medium text-white/88">Next required action</p>
              <p className="mt-2 text-sm leading-7 text-white/58">{getLeadNextAction(lead)}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {acceptedProposal && !activeContract ? (
                  <Link
                    href="/admin/contracts"
                    className={getButtonClassName({ variant: "primary" })}
                  >
                    Issue contract
                  </Link>
                ) : null}
                {activeContract ? (
                  <>
                    <Link
                      href="/admin/projects"
                      className={getButtonClassName({ variant: "secondary" })}
                    >
                      Open projects
                    </Link>
                    <Link
                      href="/admin/payments"
                      className={getButtonClassName({ variant: "ghost" })}
                    >
                      Open payments
                    </Link>
                  </>
                ) : null}
              </div>
            </div>
          </Panel>

          <Panel title="Lead Actions">
            <div className="flex flex-wrap gap-3">
              {statuses.map((status) => (
                <Button key={status} type="button" variant="secondary" onClick={() => changeStatus(status)}>
                  {getStatusActionLabel(status)}
                </Button>
              ))}
            </div>
          </Panel>

          <Panel title="Assignments" description="Keep ownership and support coverage clear across the team.">
            <form className="grid gap-3 sm:grid-cols-[1fr_180px_auto]" onSubmit={assignStaff}>
              <select className="min-h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none" value={assignmentUserId} onChange={(event) => setAssignmentUserId(event.target.value)}>
                <option value="">Select staff member</option>
                {users.items.filter((user) => ["ADMIN", "SALES", "OPS", "FINANCE"].includes(user.role)).map((user) => (
                  <option key={user.id} value={user.id}>{user.name ?? user.email ?? user.phone ?? user.id}</option>
                ))}
              </select>
              <select className="min-h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none" value={assignmentRole} onChange={(event) => setAssignmentRole(event.target.value as "PRIMARY" | "SUPPORTING")}>
                <option value="PRIMARY">Primary</option>
                <option value="SUPPORTING">Supporting</option>
              </select>
              <Button type="submit">Assign</Button>
            </form>
            <div className="mt-4 space-y-3">
              {assignments.length ? assignments.map((assignment) => (
                <div key={assignment.id} className="rounded-[22px] border border-white/8 bg-black/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-white/90">{assignment.user.name ?? assignment.user.email ?? assignment.user.phone ?? assignment.user.id}</p>
                    <StatusBadge value={assignment.role} />
                  </div>
                  <p className="mt-2 text-xs text-white/45">Started {formatRelativeDate(assignment.startedAt)}</p>
                </div>
              )) : <p className="text-sm text-white/45">No staff assignments yet.</p>}
            </div>
          </Panel>

          <Panel title="Create Proposal" description="Create a commercial proposal directly from this lead.">
            <form className="grid gap-3" onSubmit={createProposal}>
              {[["title", "Proposal title"], ["price", "Quoted price (INR)"], ["timeline", "Timeline"]].map(([key, placeholder]) => (
                <input key={key} className="min-h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none" placeholder={placeholder} value={proposalForm[key as keyof typeof proposalForm]} onChange={(event) => setProposalForm((current) => ({ ...current, [key]: event.target.value }))} />
              ))}
              <textarea className="min-h-28 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" placeholder="Scope" value={proposalForm.scope} onChange={(event) => setProposalForm((current) => ({ ...current, scope: event.target.value }))} />
              <textarea className="min-h-28 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" placeholder="Deliverables" value={proposalForm.deliverables} onChange={(event) => setProposalForm((current) => ({ ...current, deliverables: event.target.value }))} />
              <textarea className="min-h-24 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" placeholder="Additional notes" value={proposalForm.notes} onChange={(event) => setProposalForm((current) => ({ ...current, notes: event.target.value }))} />
              <Button type="submit">Create proposal</Button>
            </form>
          </Panel>

          <Panel title="Related Proposals">
            <div className="space-y-3">
              {lead.proposals?.length ? lead.proposals.map((proposal) => (
                <div key={proposal.id} className="rounded-[22px] border border-white/8 bg-black/10 p-4">
                  <div className="flex items-center justify-between gap-3"><p className="text-white/88">{proposal.title}</p><StatusBadge value={proposal.status} /></div>
                  <p className="mt-2 text-sm text-white/55">{formatCurrency(proposal.price)}</p>
                </div>
              )) : <p className="text-sm text-white/45">No proposals created yet.</p>}
            </div>
          </Panel>

          <Panel title="Internal Notes">
            <form className="grid gap-3" onSubmit={addNote}>
              <textarea className="min-h-24 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" placeholder="Capture negotiation context, operational risk, or next steps..." value={noteContent} onChange={(event) => setNoteContent(event.target.value)} />
              <Button type="submit" variant="secondary">Save note</Button>
            </form>
            <div className="mt-4 space-y-3">
              {notes.length ? notes.map((note) => (
                <div key={note.id} className="rounded-[22px] border border-white/8 bg-black/10 p-4">
                  <p className="text-sm leading-7 text-white/80">{note.content}</p>
                  <p className="mt-2 text-xs text-white/40">{note.author?.name ?? note.author?.email ?? note.author?.phone ?? "Team"} · {formatRelativeDate(note.createdAt)}</p>
                </div>
              )) : <p className="text-sm text-white/45">No internal notes yet.</p>}
            </div>
          </Panel>

          <Panel title="Timeline & Status History">
            <form className="grid gap-3" onSubmit={addManualTimeline}>
              <input className="min-h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none" placeholder="Log a call outcome, scope change, or ops checkpoint..." value={manualActivity} onChange={(event) => setManualActivity(event.target.value)} />
              <Button type="submit" variant="secondary">Add timeline entry</Button>
            </form>
            <div className="mt-4 space-y-3">
              {statusHistory.map((entry) => (
                <div key={`status-${entry.id}`} className="rounded-[22px] border border-white/8 bg-black/10 p-4">
                  <p className="text-sm text-white/88">Status moved to {entry.newStatus}</p>
                  <p className="mt-2 text-xs text-white/40">{formatRelativeDate(entry.createdAt)}</p>
                </div>
              ))}
              {timeline.map((activity) => (
                <div key={`activity-${activity.id}`} className="rounded-[22px] border border-white/8 bg-black/10 p-4">
                  <p className="text-sm text-white/88">{activity.description}</p>
                  <p className="mt-2 text-xs text-white/40">{formatRelativeDate(activity.createdAt)}</p>
                </div>
              ))}
              {!statusHistory.length && !timeline.length ? <p className="text-sm text-white/45">No activity logged yet.</p> : null}
            </div>
          </Panel>

          <Panel title="Client Thread" description="Use the shared event conversation with real file uploads.">
            <div className="space-y-3">
              {thread.length ? thread.map((message) => (
                <div key={message.id} className="rounded-[22px] border border-white/8 bg-black/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-white/90">{message.sender?.name || "System"}</p>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">{formatDate(message.createdAt)}</p>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-white/62">{message.body}</p>
                  {message.attachmentUrl ? <a href={message.attachmentUrl} target="_blank" rel="noreferrer" className={`${getButtonClassName({ variant: "ghost" })} mt-3`}>{message.attachmentName || "Open attachment"}</a> : null}
                </div>
              )) : <p className="text-sm text-white/45">No messages yet.</p>}
            </div>

            <form className="mt-5 grid gap-3" onSubmit={sendMessage}>
              <textarea className="min-h-24 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" placeholder="Message the client or event team..." value={messageBody} onChange={(event) => setMessageBody(event.target.value)} />
              <input type="file" className="text-sm text-white/70" onChange={(event) => setMessageAttachment(event.target.files?.[0] ?? null)} />
              <Button type="submit">Send message</Button>
            </form>
          </Panel>
        </div>
      </div>
    </DashboardPage>
  )
}
