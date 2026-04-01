"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import EmptyState from "@/components/admin/EmptyState"
import Panel from "@/components/admin/Panel"
import StatusBadge from "@/components/admin/StatusBadge"
import { useAssistantPageState } from "@/lib/assistant-page-state"
import { formatCurrency, formatDate, formatDateOnly } from "@/lib/admin-format"
import { staffApi } from "@/lib/staff-client"
import { uploadFileToPresignedUrl } from "@/lib/uploads"
import type { Project } from "@/types/admin"
import type { PortalEventDetailResponse } from "@/types/client-portal"
import type { StaffProjectDocument, StaffProjectUpdate, StaffTask } from "@/types/staff"

const stages = ["PLANNING", "PREPARATION", "READY", "EVENT_DAY", "COMPLETED"]

export default function StaffProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [projectId, setProjectId] = useState("")
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<StaffTask[]>([])
  const [documents, setDocuments] = useState<StaffProjectDocument[]>([])
  const [updates, setUpdates] = useState<StaffProjectUpdate[]>([])
  const [thread, setThread] = useState<PortalEventDetailResponse["messages"]>([])
  const [messageBody, setMessageBody] = useState("")
  const [messageAttachment, setMessageAttachment] = useState<File | null>(null)
  const [taskAttachment, setTaskAttachment] = useState<Record<string, File | null>>({})
  const [taskForm, setTaskForm] = useState({ title: "", description: "", dueDate: "", priority: "MEDIUM" })
  const [updateForm, setUpdateForm] = useState({ title: "", body: "", stage: "PREPARATION" })
  const [projectDocument, setProjectDocument] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (id: string) => {
    try {
      const [nextProject, nextTasks, nextDocuments, nextUpdates] = await Promise.all([
        staffApi.getProject(id),
        staffApi.listProjectTasks(id),
        staffApi.listProjectDocuments(id),
        staffApi.listProjectUpdates(id),
      ])
      setProject(nextProject)
      setTasks(nextTasks)
      setDocuments(nextDocuments)
      setUpdates(nextUpdates)
      const linkedLeadId = nextProject.contract?.proposal?.lead?.id
      if (linkedLeadId) {
        const nextThread = await staffApi.getThread(linkedLeadId)
        setThread(nextThread)
      } else {
        setThread([])
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load project.")
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

  const leadId = useMemo(() => project?.contract?.proposal?.lead?.id ?? "", [project])

  const assistantPageState = useMemo(
    () => ({
      currentTab: "overview",
      currentView: "staff-project-detail",
      selectedProjectId: project?.id ?? projectId ?? null,
      selectedBookingId: leadId || null,
      filters: {
        status: project?.status ?? null,
      },
    }),
    [leadId, project?.id, project?.status, projectId],
  )

  useAssistantPageState(assistantPageState)

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!leadId) return
    try {
      let attachmentPayload: { attachmentName?: string; attachmentKey?: string; attachmentUrl?: string } = {}
      if (messageAttachment) {
        const upload = await staffApi.createMessageUploadUrl(leadId, {
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

      await staffApi.sendMessage(leadId, {
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

  if (error && !project) return <EmptyState title="Project unavailable" description={error} />
  if (!project) return <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 text-white/65">Loading project...</div>

  return (
    <div className="space-y-6">
      <Panel title={project.contract?.proposal?.title ?? "Project"} description={`${project.contract?.proposal?.lead?.location ?? "Location pending"} · ${formatDateOnly(project.contract?.proposal?.lead?.eventDate)}`}>
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="flex items-center gap-3">
              <StatusBadge value={project.status} />
              <p className="text-sm text-white/45">Progress {project.progress}%</p>
            </div>
            <p className="mt-4 text-sm leading-7 text-white/58">{project.summary || "No project summary added yet."}</p>
            <div className="mt-5 h-2 rounded-full bg-white/8">
              <div className="h-2 rounded-full bg-gradient-to-r from-[#d4af37] to-[#8d6f2b]" style={{ width: `${Math.max(6, project.progress)}%` }} />
            </div>
          </div>
          <div className="rounded-[22px] border border-white/8 bg-black/10 p-4">
            <p className="text-sm text-white/90">Budget + payments</p>
            <p className="mt-3 text-lg text-[#f2d47f]">{project.payments?.reduce((sum, payment) => sum + payment.amount, 0) ? formatCurrency(project.payments?.reduce((sum, payment) => sum + payment.amount, 0)) : "No milestones"}</p>
            <p className="mt-2 text-xs text-white/45">Client {project.client?.name ?? project.client?.phone ?? project.client?.email}</p>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel title="Execution Tasks" description="The event delivery engine for this project.">
          <div className="grid gap-3 md:grid-cols-4">
            {["PENDING", "IN_PROGRESS", "DONE", "BLOCKED"].map((status) => (
              <div key={status} className="space-y-3 rounded-[24px] border border-white/8 bg-black/10 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{status.replaceAll("_", " ")}</p>
                {tasks.filter((task) => task.status === status).map((task) => (
                  <div key={task.id} className="rounded-[18px] border border-white/8 bg-black/20 p-3">
                    <p className="text-sm text-white/92">{task.title}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/35">{task.priority}</p>
                    <p className="mt-2 text-xs text-white/45">Due {formatDateOnly(task.dueDate)}</p>
                    <select className="mt-3 min-h-10 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-white outline-none" defaultValue={task.status} onChange={async (event) => {
                      await staffApi.updateProjectTask(project.id, task.id, { status: event.target.value })
                      await load(project.id)
                    }}>
                      {["PENDING", "IN_PROGRESS", "DONE", "BLOCKED"].map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                    <form className="mt-3 grid gap-2" onSubmit={async (event) => {
                      event.preventDefault()
                      const formData = new FormData(event.currentTarget)
                      const body = String(formData.get("comment") ?? "")
                      if (body) {
                        await staffApi.addTaskComment(project.id, task.id, body)
                      }
                      const file = taskAttachment[task.id]
                      if (file) {
                        const upload = await staffApi.createTaskAttachmentUploadUrl(project.id, task.id, {
                          fileName: file.name,
                          contentType: file.type || "application/octet-stream",
                          sizeBytes: file.size,
                        })
                        await uploadFileToPresignedUrl(upload.url, file)
                        setTaskAttachment((current) => ({ ...current, [task.id]: null }))
                      }
                      event.currentTarget.reset()
                      await load(project.id)
                    }}>
                      <input name="comment" className="min-h-10 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-white outline-none" placeholder="Comment or blocker update" />
                      <input type="file" className="text-xs text-white/60" onChange={(event) => setTaskAttachment((current) => ({ ...current, [task.id]: event.target.files?.[0] ?? null }))} />
                      <button type="submit" className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#d4af37]/35 px-3 text-[11px] uppercase tracking-[0.18em] text-[#f2d47f]">Update Task</button>
                    </form>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-3 rounded-[22px] border border-white/8 bg-black/10 p-4 md:grid-cols-4">
            <input className="min-h-11 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none" placeholder="Task title" value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} />
            <input className="min-h-11 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none" placeholder="Due date" type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))} />
            <select className="min-h-11 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none" value={taskForm.priority} onChange={(event) => setTaskForm((current) => ({ ...current, priority: event.target.value }))}>
              {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((priority) => <option key={priority} value={priority}>{priority}</option>)}
            </select>
            <button type="button" className="inline-flex min-h-11 items-center justify-center rounded-full bg-gradient-to-r from-[#d4af37] to-[#9a7b2f] px-4 text-xs uppercase tracking-[0.18em] text-black" onClick={async () => {
              await staffApi.createProjectTask(project.id, {
                title: taskForm.title,
                description: taskForm.description,
                dueDate: taskForm.dueDate ? new Date(taskForm.dueDate).toISOString() : undefined,
                priority: taskForm.priority,
              })
              setTaskForm({ title: "", description: "", dueDate: "", priority: "MEDIUM" })
              await load(project.id)
            }}>Create Task</button>
            <textarea className="min-h-20 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white outline-none md:col-span-4" placeholder="Task description" value={taskForm.description} onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))} />
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Milestones & Updates" description="Operational updates shared by the team.">
            <div className="space-y-3">
              {updates.map((update) => (
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
              <input className="min-h-11 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none" placeholder="Update title" value={updateForm.title} onChange={(event) => setUpdateForm((current) => ({ ...current, title: event.target.value }))} />
              <select className="min-h-11 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none" value={updateForm.stage} onChange={(event) => setUpdateForm((current) => ({ ...current, stage: event.target.value }))}>
                {stages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
              </select>
              <textarea className="min-h-24 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white outline-none" placeholder="Narrative update" value={updateForm.body} onChange={(event) => setUpdateForm((current) => ({ ...current, body: event.target.value }))} />
              <button type="button" className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#d4af37]/35 px-4 text-xs uppercase tracking-[0.18em] text-[#f2d47f]" onClick={async () => {
                await staffApi.createProjectUpdate(project.id, updateForm)
                setUpdateForm({ title: "", body: "", stage: "PREPARATION" })
                await load(project.id)
              }}>Post Update</button>
            </div>
          </Panel>

          <Panel title="Documents & Payments" description="Briefs, deliverables, and commercial history.">
            <div className="space-y-3">
              {documents.map((document) => (
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
              <div className="rounded-[20px] border border-white/8 bg-black/10 p-4">
                <input type="file" className="text-sm text-white/70" onChange={(event) => setProjectDocument(event.target.files?.[0] ?? null)} />
                <button type="button" className="mt-3 inline-flex min-h-10 items-center justify-center rounded-full border border-white/12 px-4 text-xs uppercase tracking-[0.18em] text-white/82" onClick={async () => {
                  if (!projectDocument) return
                  const upload = await staffApi.createProjectDocumentUploadUrl(project.id, {
                    fileName: projectDocument.name,
                    contentType: projectDocument.type || "application/octet-stream",
                    sizeBytes: projectDocument.size,
                    category: "OPERATIONS",
                  })
                  await uploadFileToPresignedUrl(upload.url, projectDocument)
                  setProjectDocument(null)
                  await load(project.id)
                }}>Upload Document</button>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {project.payments?.map((payment) => (
                <div key={payment.id} className="rounded-[20px] border border-white/8 bg-black/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-white/92">{payment.type} milestone</p>
                      <p className="mt-1 text-xs text-white/45">{formatDateOnly(payment.dueDate)}</p>
                    </div>
                    <StatusBadge value={payment.status} />
                  </div>
                  <p className="mt-3 text-lg text-[#f2d47f]">{formatCurrency(payment.amount)}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {leadId ? (
        <Panel title="Client Thread" description="Client coordination attached to this project.">
          <div className="space-y-3">
            {thread.map((message) => (
              <div key={message.id} className="rounded-[20px] border border-white/8 bg-black/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-white/90">{message.sender?.name || "System"}</p>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">{formatDate(message.createdAt)}</p>
                </div>
                <p className="mt-3 text-sm leading-7 text-white/62">{message.body}</p>
                {message.attachmentUrl ? <a href={message.attachmentUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs uppercase tracking-[0.18em] text-[#f2d47f]">{message.attachmentName || "Open attachment"}</a> : null}
              </div>
            ))}
          </div>
          <form className="mt-5 grid gap-3" onSubmit={sendMessage}>
            <textarea className="min-h-28 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" placeholder="Reply to the client" value={messageBody} onChange={(event) => setMessageBody(event.target.value)} />
            <input type="file" className="text-sm text-white/70" onChange={(event) => setMessageAttachment(event.target.files?.[0] ?? null)} />
            <button type="submit" className="inline-flex min-h-12 items-center justify-center rounded-full bg-gradient-to-r from-[#d4af37] to-[#9a7b2f] px-5 text-xs font-medium uppercase tracking-[0.22em] text-black">Send Message</button>
          </form>
        </Panel>
      ) : null}
    </div>
  )
}
