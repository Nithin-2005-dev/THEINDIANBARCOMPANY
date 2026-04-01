"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import EmptyState from "@/components/admin/EmptyState"
import Panel from "@/components/admin/Panel"
import StatusBadge from "@/components/admin/StatusBadge"
import { useAssistantPageState } from "@/lib/assistant-page-state"
import { formatCurrency, formatDate, formatDateOnly } from "@/lib/admin-format"
import { uploadFileToPresignedUrl } from "@/lib/uploads"
import { vendorApi } from "@/lib/vendor-client"
import type { PortalEventDetailResponse } from "@/types/client-portal"
import type { VendorProjectResponse } from "@/types/vendor"

const taskStatuses = ["PENDING", "IN_PROGRESS", "DONE", "BLOCKED"]
const stages = ["PLANNING", "PREPARATION", "READY", "EVENT_DAY", "COMPLETED"]

export default function VendorProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [projectId, setProjectId] = useState("")
  const [data, setData] = useState<VendorProjectResponse | null>(null)
  const [thread, setThread] = useState<PortalEventDetailResponse["messages"]>([])
  const [statusForm, setStatusForm] = useState({ title: "", body: "", stage: "PREPARATION" })
  const [messageBody, setMessageBody] = useState("")
  const [messageAttachment, setMessageAttachment] = useState<File | null>(null)
  const [projectDocument, setProjectDocument] = useState<File | null>(null)
  const [taskAttachment, setTaskAttachment] = useState<Record<string, File | null>>({})
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (id: string) => {
    try {
      const nextProject = await vendorApi.getProject(id)
      setData(nextProject)
      if (nextProject.event.leadId) {
        const nextThread = await vendorApi.getThread(nextProject.event.leadId)
        setThread(nextThread)
      } else {
        setThread([])
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load assignment.")
    }
  }, [])

  useEffect(() => {
    let active = true

    params.then(({ id }) => {
      if (!active) return
      setProjectId(id)
      void load(id)
    })
    return () => {
      active = false
    }
  }, [load, params])

  const assistantPageState = useMemo(
    () => ({
      currentTab: "overview",
      currentView: "vendor-project-detail",
      selectedProjectId: data?.project.id ?? projectId ?? null,
      selectedBookingId: data?.event.leadId ?? null,
      filters: {
        status: data?.project.status ?? null,
      },
    }),
    [data?.event.leadId, data?.project.id, data?.project.status, projectId],
  )

  useAssistantPageState(assistantPageState)

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!data?.event.leadId) return

    try {
      let attachmentPayload: { attachmentName?: string; attachmentKey?: string; attachmentUrl?: string } = {}

      if (messageAttachment) {
        const upload = await vendorApi.createMessageUploadUrl(data.event.leadId, {
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

      await vendorApi.sendMessage(data.event.leadId, {
        body: messageBody,
        ...attachmentPayload,
      })

      setMessageBody("")
      setMessageAttachment(null)
      await load(projectId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send message.")
    }
  }

  if (error && !data) {
    return <EmptyState title="Assignment unavailable" description={error} />
  }

  if (!data) {
    return <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 text-white/65">Loading assignment...</div>
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <div className="space-y-6">
        <Panel title={data.event.title} description={`${data.event.location} | ${formatDateOnly(data.event.eventDate)}`}>
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div>
              <div className="flex items-center gap-3">
                <StatusBadge value={data.project.status} />
                <p className="text-sm text-white/45">Progress {data.project.progress}%</p>
              </div>
              <p className="mt-4 text-sm leading-7 text-white/58">
                {data.event.eventType} in {data.event.city ?? "the confirmed city"}.
              </p>
              <p className="mt-3 text-sm leading-7 text-white/48">
                {data.event.notes || "Detailed requirements will continue to appear here as ops updates the plan."}
              </p>
              <div className="mt-5 h-2 rounded-full bg-white/8">
                <div className="h-2 rounded-full bg-gradient-to-r from-[#d4af37] to-[#8d6f2b]" style={{ width: `${Math.max(8, data.project.progress)}%` }} />
              </div>
            </div>

            <div className="rounded-[22px] border border-white/8 bg-black/10 p-4">
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">Ops Contact</p>
              <p className="mt-3 text-lg text-white/92">{data.opsContact?.name ?? "Ops team"}</p>
              <p className="mt-1 text-sm text-white/45">{data.opsContact?.phone ?? data.opsContact?.email ?? "Contact details will appear here."}</p>
              <p className="mt-5 text-[10px] uppercase tracking-[0.22em] text-white/35">Commercial Status</p>
              <p className="mt-3 text-lg text-[#f2d47f]">
                {formatCurrency(data.payments.filter((payment) => payment.status === "PAID").reduce((sum, payment) => sum + payment.amount, 0))}
              </p>
              <p className="mt-1 text-xs text-white/45">Event payments received by the platform</p>
            </div>
          </div>
        </Panel>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel title="Assigned Tasks" description="Update completion status, blockers, comments, and attachments.">
            <div className="space-y-3">
              {data.tasks.length ? (
                data.tasks.map((task) => (
                  <div key={task.id} className="rounded-[22px] border border-white/8 bg-black/10 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <p className="text-sm text-white/92">{task.title}</p>
                          <StatusBadge value={task.status} />
                        </div>
                        <p className="mt-2 text-xs text-white/45">{task.priority} priority | Due {formatDateOnly(task.dueDate)}</p>
                        {task.description ? <p className="mt-3 text-sm leading-7 text-white/58">{task.description}</p> : null}
                        {task.blockedReason ? <p className="mt-3 text-sm text-rose-200/85">Blocked: {task.blockedReason}</p> : null}
                      </div>
                      <select
                        className="min-h-10 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-white outline-none"
                        value={task.status}
                        onChange={async (event) => {
                          await vendorApi.updateProjectTask(data.project.id, task.id, { status: event.target.value })
                          await load(projectId)
                        }}
                      >
                        {taskStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>

                    <form
                      className="mt-4 grid gap-2"
                      onSubmit={async (event) => {
                        event.preventDefault()
                        const formData = new FormData(event.currentTarget)
                        const body = String(formData.get("comment") ?? "")
                        if (body) {
                          await vendorApi.addTaskComment(data.project.id, task.id, body)
                        }
                        const file = taskAttachment[task.id]
                        if (file) {
                          const upload = await vendorApi.createTaskAttachmentUploadUrl(data.project.id, task.id, {
                            fileName: file.name,
                            contentType: file.type || "application/octet-stream",
                            sizeBytes: file.size,
                          })
                          await uploadFileToPresignedUrl(upload.url, file)
                          setTaskAttachment((current) => ({ ...current, [task.id]: null }))
                        }
                        event.currentTarget.reset()
                        await load(projectId)
                      }}
                    >
                      <input
                        name="comment"
                        className="min-h-10 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-white outline-none"
                        placeholder="Add a status note or blocker update"
                      />
                      <input
                        type="file"
                        className="text-xs text-white/60"
                        onChange={(event) => setTaskAttachment((current) => ({ ...current, [task.id]: event.target.files?.[0] ?? null }))}
                      />
                      <button type="submit" className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#d4af37]/35 px-3 text-[11px] uppercase tracking-[0.18em] text-[#f2d47f]">
                        Update Task
                      </button>
                    </form>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/55">No tasks are assigned yet.</p>
              )}
            </div>
          </Panel>

          <div className="space-y-6">
            <Panel title="Vendor Updates" description="Share progress directly with the operations team.">
              <div className="space-y-3">
                {data.updates.map((update) => (
                  <div key={update.id} className="rounded-[20px] border border-white/8 bg-black/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-white/92">{update.title}</p>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">{formatDate(update.createdAt)}</p>
                    </div>
                    <p className="mt-2 text-xs text-white/45">{update.stage}</p>
                    {update.body ? <p className="mt-3 text-sm leading-7 text-white/62">{update.body}</p> : null}
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-3">
                <input
                  className="min-h-11 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none"
                  placeholder="Update title"
                  value={statusForm.title}
                  onChange={(event) => setStatusForm((current) => ({ ...current, title: event.target.value }))}
                />
                <select
                  className="min-h-11 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none"
                  value={statusForm.stage}
                  onChange={(event) => setStatusForm((current) => ({ ...current, stage: event.target.value }))}
                >
                  {stages.map((stage) => (
                    <option key={stage} value={stage}>
                      {stage}
                    </option>
                  ))}
                </select>
                <textarea
                  className="min-h-24 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white outline-none"
                  placeholder="Progress details, access requirements, or completion notes"
                  value={statusForm.body}
                  onChange={(event) => setStatusForm((current) => ({ ...current, body: event.target.value }))}
                />
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#d4af37]/35 px-4 text-xs uppercase tracking-[0.18em] text-[#f2d47f]"
                  onClick={async () => {
                    await vendorApi.createStatusUpdate(projectId, {
                      stage: statusForm.stage,
                      title: statusForm.title || undefined,
                      body: statusForm.body || undefined,
                    })
                    setStatusForm({ title: "", body: "", stage: "PREPARATION" })
                    await load(projectId)
                  }}
                >
                  Share Update
                </button>
              </div>
            </Panel>

            <Panel title="Deliverables & Documents" description="Upload files for ops review and keep requirements close at hand.">
              <div className="space-y-3">
                {data.documents.map((document) => (
                  <a key={document.id} href={document.fileUrl} target="_blank" rel="noreferrer" className="block rounded-[20px] border border-white/8 bg-black/10 p-4 transition hover:border-[#d4af37]/25">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-white/92">{document.fileName}</p>
                        <p className="mt-1 text-xs text-white/45">{document.category}</p>
                      </div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">{formatDate(document.createdAt)}</p>
                    </div>
                  </a>
                ))}
              </div>

              <div className="mt-4 rounded-[20px] border border-white/8 bg-black/10 p-4">
                <input type="file" className="text-sm text-white/70" onChange={(event) => setProjectDocument(event.target.files?.[0] ?? null)} />
                <button
                  type="button"
                  className="mt-3 inline-flex min-h-10 items-center justify-center rounded-full border border-white/12 px-4 text-xs uppercase tracking-[0.18em] text-white/82"
                  onClick={async () => {
                    if (!projectDocument) return
                    const upload = await vendorApi.createProjectDocumentUploadUrl(projectId, {
                      fileName: projectDocument.name,
                      contentType: projectDocument.type || "application/octet-stream",
                      sizeBytes: projectDocument.size,
                      category: "DELIVERABLE",
                    })
                    await uploadFileToPresignedUrl(upload.url, projectDocument)
                    setProjectDocument(null)
                    await load(projectId)
                  }}
                >
                  Upload Deliverable
                </button>
              </div>
            </Panel>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Panel title="Commercial Visibility" description="Event-side payment status visible to your team.">
            <div className="space-y-3">
              {data.payments.length ? (
                data.payments.map((payment) => (
                  <div key={payment.id} className="rounded-[20px] border border-white/8 bg-black/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-white/92">{payment.type} milestone</p>
                        <p className="mt-1 text-xs text-white/45">Due {formatDateOnly(payment.dueDate)}</p>
                      </div>
                      <StatusBadge value={payment.status} />
                    </div>
                    <p className="mt-3 text-lg text-[#f2d47f]">{formatCurrency(payment.amount)}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/55">No payment visibility is available yet.</p>
              )}
            </div>
          </Panel>

          <Panel title="Ops Thread" description="Coordinate directly with the operations team on this assignment.">
            <div className="space-y-3">
              {thread.map((message) => (
                <div key={message.id} className="rounded-[20px] border border-white/8 bg-black/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-white/90">{message.sender?.name || "System"}</p>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">{formatDate(message.createdAt)}</p>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-white/62">{message.body}</p>
                  {message.attachmentUrl ? (
                    <a href={message.attachmentUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs uppercase tracking-[0.18em] text-[#f2d47f]">
                      {message.attachmentName || "Open attachment"}
                    </a>
                  ) : null}
                </div>
              ))}
            </div>

            <form className="mt-5 grid gap-3" onSubmit={sendMessage}>
              <textarea
                className="min-h-28 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                placeholder="Share a question, blocker, or delivery confirmation"
                value={messageBody}
                onChange={(event) => setMessageBody(event.target.value)}
              />
              <input type="file" className="text-sm text-white/70" onChange={(event) => setMessageAttachment(event.target.files?.[0] ?? null)} />
              <button type="submit" className="inline-flex min-h-12 items-center justify-center rounded-full bg-gradient-to-r from-[#d4af37] to-[#9a7b2f] px-5 text-xs font-medium uppercase tracking-[0.22em] text-black">
                Send Message
              </button>
            </form>
          </Panel>
        </div>
      </div>
    </main>
  )
}
