"use client"

import { FormEvent, useDeferredValue, useMemo, useState } from "react"
import StatusBadge from "@/components/admin/StatusBadge"
import { useAdminResource } from "@/components/admin/useAdminResource"
import {
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
import { useToast } from "@/components/dashboard/ToastProvider"
import { VirtualizedList } from "@/components/dashboard/VirtualizedList"
import { adminApi } from "@/lib/admin-client"
import { useAssistantPageState } from "@/lib/assistant-page-state"
import {
  formatCurrency,
  formatDateOnly,
  formatRelativeDate,
} from "@/lib/admin-format"
import type { AdminUser, Project, ProjectStatus, ProjectUpdate, Vendor } from "@/types/admin"
import styles from "./page.module.css"

const projectStatuses: ProjectStatus[] = ["PLANNING", "PREPARATION", "EXECUTION", "COMPLETED", "CANCELLED"]
const projectStages: ProjectUpdate["stage"][] = ["PLANNING", "PREPARATION", "READY", "EVENT_DAY", "COMPLETED"]

function getProjectNextAction(project: Project) {
  const pendingPayment = project.payments?.find((payment) =>
    ["PENDING", "FAILED"].includes(payment.status),
  )

  if (!project.assignments?.length) {
    return "Assign a primary internal owner."
  }
  if (project.status !== "COMPLETED" && !pendingPayment) {
    return "Schedule the next payment milestone."
  }
  if (project.status === "PLANNING") {
    return "Share the planning update with the client."
  }
  if (project.status === "PREPARATION" && !project.vendors?.length) {
    return "Assign vendors before moving deeper into preparation."
  }
  if (project.status === "EXECUTION") {
    return "Track delivery progress and publish event-day updates."
  }
  if (project.status === "COMPLETED") {
    return "Collect post-event feedback and archive the project."
  }

  return pendingPayment
    ? `${pendingPayment.type.toLowerCase()} payment is still awaiting collection.`
    : "Keep operations updates flowing across the team and client portal."
}

function deriveStageFromStatus(status: ProjectStatus): ProjectUpdate["stage"] {
  if (status === "PLANNING") return "PLANNING"
  if (status === "PREPARATION") return "PREPARATION"
  if (status === "EXECUTION") return "EVENT_DAY"
  if (status === "COMPLETED") return "COMPLETED"
  return "PLANNING"
}

function ProjectLifecycle({ project }: { project: Project }) {
  const steps = [
    { label: "Contract signed", complete: true },
    { label: "Project planning", complete: ["PLANNING", "PREPARATION", "EXECUTION", "COMPLETED"].includes(project.status) },
    { label: "Preparation", complete: ["PREPARATION", "EXECUTION", "COMPLETED"].includes(project.status) },
    { label: "Execution", complete: ["EXECUTION", "COMPLETED"].includes(project.status) },
    { label: "Completion", complete: project.status === "COMPLETED" },
  ]

  return (
    <div className="grid gap-2 sm:grid-cols-5">
      {steps.map((step, index) => (
        <div
          key={step.label}
          className={`rounded-[18px] border px-3 py-3 text-sm ${
            step.complete
              ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
              : "border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.03)] text-[var(--dashboard-muted)]"
          }`}
        >
          <p className={styles.eyebrow}>Step {index + 1}</p>
          <p className="mt-2 font-medium">{step.label}</p>
        </div>
      ))}
    </div>
  )
}

function ProjectCard({
  project,
  users,
  vendors,
  onUpdateProject,
  onAssignVendor,
  onAssignStaff,
  onCreateUpdate,
}: {
  project: Project
  users: AdminUser[]
  vendors: Vendor[]
  onUpdateProject: (projectId: string, payload: { status?: ProjectStatus; progress?: number }) => Promise<void>
  onAssignVendor: (projectId: string, vendorId: string) => Promise<void>
  onAssignStaff: (projectId: string, userId: string, role: "PRIMARY" | "SUPPORTING") => Promise<void>
  onCreateUpdate: (
    projectId: string,
    payload: { stage: ProjectUpdate["stage"]; title: string; body?: string; isInternal?: boolean },
  ) => Promise<void>
}) {
  const [progressValue, setProgressValue] = useState(String(project.progress))
  const [staffUserId, setStaffUserId] = useState("")
  const [staffRole, setStaffRole] = useState<"PRIMARY" | "SUPPORTING">("PRIMARY")
  const [vendorId, setVendorId] = useState("")
  const [updateForm, setUpdateForm] = useState({
    stage: deriveStageFromStatus(project.status),
    title: "",
    body: "",
    isInternal: false,
  })

  const pendingPayment = project.payments?.find((payment) =>
    ["PENDING", "FAILED"].includes(payment.status),
  )
  const paidValue = (project.payments ?? [])
    .filter((payment) => payment.status === "PAID")
    .reduce((sum, payment) => sum + payment.amount, 0)
  const totalValue = (project.payments ?? []).reduce((sum, payment) => sum + payment.amount, 0)
  const primaryOwner = project.assignments?.find((assignment) => assignment.role === "PRIMARY")?.user

  return (
    <article className="rounded-[26px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] p-5">
      <div className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--dashboard-text)]">
                {project.contract?.proposal?.title ?? `Project ${project.id.slice(0, 8)}`}
              </h3>
              <StatusBadge value={project.status} />
            </div>
            <p className="mt-2 text-sm text-[var(--dashboard-muted)]">
              {project.contract?.proposal?.lead?.eventType ?? "Confirmed event"} at{" "}
              {project.contract?.proposal?.lead?.location ?? "TBD"}
            </p>
            <p className="mt-1 text-sm text-[var(--dashboard-muted)]">
              {project.client?.name ?? project.client?.email ?? project.client?.phone ?? "Client"}
            </p>
          </div>
          <div className="w-full max-w-sm">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-[var(--dashboard-subtle)]">
              <span>Progress</span>
              <span>{project.progress}%</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-white/8">
              <div
                className="h-2 rounded-full bg-[linear-gradient(135deg,var(--dashboard-accent),var(--dashboard-accent-strong))]"
                style={{ width: `${Math.max(8, project.progress)}%` }}
              />
            </div>
            <p className="mt-4 text-sm text-[var(--dashboard-muted)]">{getProjectNextAction(project)}</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[20px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.03)] p-4">
            <p className={styles.eyebrow}>Event Date</p>
            <p className="mt-2 text-sm font-medium text-[var(--dashboard-text)]">
              {formatDateOnly(project.contract?.proposal?.lead?.eventDate)}
            </p>
          </div>
          <div className="rounded-[20px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.03)] p-4">
            <p className={styles.eyebrow}>Primary Owner</p>
            <p className="mt-2 text-sm font-medium text-[var(--dashboard-text)]">
              {primaryOwner?.name ?? primaryOwner?.email ?? primaryOwner?.phone ?? "Unassigned"}
            </p>
          </div>
          <div className="rounded-[20px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.03)] p-4">
            <p className={styles.eyebrow}>Collection</p>
            <p className="mt-2 text-sm font-medium text-[var(--dashboard-text)]">
              {formatCurrency(paidValue)} / {formatCurrency(totalValue)}
            </p>
          </div>
          <div className="rounded-[20px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.03)] p-4">
            <p className={styles.eyebrow}>Pending Due</p>
            <p className="mt-2 text-sm font-medium text-[var(--dashboard-text)]">
              {pendingPayment ? `${pendingPayment.type} | ${formatDateOnly(pendingPayment.dueDate)}` : "None"}
            </p>
          </div>
        </div>

        <ProjectLifecycle project={project} />

        <div className="grid gap-4 2xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4 rounded-[22px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="grid gap-2 text-sm text-[var(--dashboard-muted)]">
                Status
                <select
                  className="min-h-11 rounded-[16px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] px-4 text-sm text-[var(--dashboard-text)] outline-none"
                  value={project.status}
                  onChange={(event) =>
                    void onUpdateProject(project.id, {
                      status: event.target.value as ProjectStatus,
                    })
                  }
                >
                  {projectStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm text-[var(--dashboard-muted)]">
                Progress %
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={progressValue}
                  onChange={(event) => setProgressValue(event.target.value)}
                  onBlur={() =>
                    void onUpdateProject(project.id, {
                      progress: Number(progressValue || project.progress),
                    })
                  }
                  className="min-h-11 rounded-[16px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] px-4 text-sm text-[var(--dashboard-text)] outline-none"
                />
              </label>
              <label className="grid gap-2 text-sm text-[var(--dashboard-muted)]">
                Assign vendor
                <select
                  className="min-h-11 rounded-[16px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] px-4 text-sm text-[var(--dashboard-text)] outline-none"
                  value={vendorId}
                  onChange={(event) => {
                    const nextVendorId = event.target.value
                    setVendorId(nextVendorId)
                    if (nextVendorId) {
                      void onAssignVendor(project.id, nextVendorId)
                    }
                  }}
                >
                  <option value="">Choose vendor</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name} | {vendor.serviceType}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-2 text-sm text-[var(--dashboard-muted)]">
                <span>Current vendors</span>
                <div className="flex flex-wrap gap-2">
                  {project.vendors?.length ? (
                    project.vendors.map((assignment) => (
                      <div key={assignment.id} className={styles.softPill}>
                        {assignment.vendor.name}
                      </div>
                    ))
                  ) : (
                    <div className={styles.softPill}>No vendors</div>
                  )}
                </div>
              </div>
            </div>

            <form
              className="grid gap-3 border-t border-[var(--dashboard-border)] pt-4 md:grid-cols-[1fr_180px_auto]"
              onSubmit={(event) => {
                event.preventDefault()
                if (!staffUserId) return
                void onAssignStaff(project.id, staffUserId, staffRole)
                setStaffUserId("")
                setStaffRole("PRIMARY")
              }}
            >
              <select
                className="min-h-11 rounded-[16px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] px-4 text-sm text-[var(--dashboard-text)] outline-none"
                value={staffUserId}
                onChange={(event) => setStaffUserId(event.target.value)}
              >
                <option value="">Assign internal owner</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name ?? user.email ?? user.phone ?? user.id}
                  </option>
                ))}
              </select>
              <select
                className="min-h-11 rounded-[16px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] px-4 text-sm text-[var(--dashboard-text)] outline-none"
                value={staffRole}
                onChange={(event) => setStaffRole(event.target.value as "PRIMARY" | "SUPPORTING")}
              >
                <option value="PRIMARY">Primary</option>
                <option value="SUPPORTING">Supporting</option>
              </select>
              <button
                type="submit"
                className={`${styles.secondaryButton} inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm`}
              >
                Assign staff
              </button>
            </form>
          </div>

          <div className="rounded-[22px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.03)] p-4">
            <p className="text-sm font-medium text-[var(--dashboard-text)]">Project update</p>
            <p className="mt-1 text-sm text-[var(--dashboard-muted)]">
              Send a visible client update or keep it internal for the team only.
            </p>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault()
                if (!updateForm.title.trim()) return
                void onCreateUpdate(project.id, {
                  stage: updateForm.stage,
                  title: updateForm.title.trim(),
                  body: updateForm.body.trim() || undefined,
                  isInternal: updateForm.isInternal,
                })
                setUpdateForm({
                  stage: deriveStageFromStatus(project.status),
                  title: "",
                  body: "",
                  isInternal: false,
                })
              }}
            >
              <select
                className="min-h-11 w-full rounded-[16px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] px-4 text-sm text-[var(--dashboard-text)] outline-none"
                value={updateForm.stage}
                onChange={(event) =>
                  setUpdateForm((current) => ({
                    ...current,
                    stage: event.target.value as ProjectUpdate["stage"],
                  }))
                }
              >
                {projectStages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
              <input
                value={updateForm.title}
                onChange={(event) =>
                  setUpdateForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Update title"
                className="min-h-11 w-full rounded-[16px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] px-4 text-sm text-[var(--dashboard-text)] outline-none"
              />
              <textarea
                value={updateForm.body}
                onChange={(event) =>
                  setUpdateForm((current) => ({ ...current, body: event.target.value }))
                }
                placeholder="What changed, what is next, and what the client should know"
                className="min-h-24 w-full rounded-[16px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--dashboard-text)] outline-none"
              />
              <label className="flex items-center gap-3 text-sm text-[var(--dashboard-muted)]">
                <input
                  type="checkbox"
                  checked={updateForm.isInternal}
                  onChange={(event) =>
                    setUpdateForm((current) => ({
                      ...current,
                      isInternal: event.target.checked,
                    }))
                  }
                />
                Internal update only
              </label>
              <button
                type="submit"
                className={`${styles.secondaryButton} inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm`}
              >
                Publish update
              </button>
            </form>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(project.assignments ?? []).map((assignment) => (
            <div key={assignment.id} className={styles.softPill}>
              {assignment.role}: {assignment.user.name ?? assignment.user.email ?? assignment.user.phone}
            </div>
          ))}
          {pendingPayment ? (
            <div className={styles.softPill}>
              Next due {pendingPayment.type} | {formatDateOnly(pendingPayment.dueDate)}
            </div>
          ) : null}
          <div className={styles.softPill}>Updated {formatRelativeDate(project.updatedAt)}</div>
        </div>
      </div>
    </article>
  )
}

export default function AdminProjectsPage() {
  const { pushToast } = useToast()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState("")
  const [search, setSearch] = useState("")
  const [location, setLocation] = useState("")
  const deferredSearch = useDeferredValue(search)
  const deferredLocation = useDeferredValue(location)

  const { data, error, isLoading, isRefreshing, reload } = useAdminResource(async () => {
    const params = new URLSearchParams({ page: String(page), limit: "12" })
    if (status) params.set("status", status)
    if (deferredSearch.trim()) params.set("search", deferredSearch.trim())
    if (deferredLocation.trim()) params.set("location", deferredLocation.trim())

    const [projects, vendors, users] = await Promise.all([
      adminApi.listProjects(params),
      adminApi.listVendors(new URLSearchParams({ page: "1", limit: "100" })),
      adminApi.listUsers(new URLSearchParams({ page: "1", limit: "100" })),
    ])

    return {
      projects,
      vendors: vendors.items,
      users: users.items.filter((user) =>
        ["ADMIN", "SALES", "OPS", "FINANCE"].includes(user.role),
      ),
    }
  }, [deferredLocation, deferredSearch, page, status], {
    refreshIntervalMs: 30000,
  })

  const metrics = useMemo(() => {
    const projects = data?.projects.items ?? []

    return {
      active: projects.filter((project) => !["COMPLETED", "CANCELLED"].includes(project.status)).length,
      execution: projects.filter((project) => project.status === "EXECUTION").length,
      completed: projects.filter((project) => project.status === "COMPLETED").length,
      pendingPayments: projects.reduce((count, project) => {
        return count + (project.payments?.filter((payment) => payment.status === "PENDING").length ?? 0)
      }, 0),
    }
  }, [data?.projects.items])

  const assistantPageState = useMemo(
    () => ({
      currentTab: "projects",
      currentView: "admin-projects",
      searchTerm: search.trim() || null,
      pendingPaymentCount: metrics.pendingPayments,
      filters: {
        status: status || null,
        location: location.trim() || null,
      },
    }),
    [location, metrics.pendingPayments, search, status],
  )

  useAssistantPageState(assistantPageState)

  const updateProject = async (
    projectId: string,
    payload: { status?: ProjectStatus; progress?: number },
  ) => {
    try {
      await adminApi.updateProject(projectId, payload)
      pushToast({
        title: "Project updated",
        description: "Operational changes have been saved.",
        tone: "success",
      })
      await reload()
    } catch (updateError) {
      pushToast({
        title: "Unable to update project",
        description: updateError instanceof Error ? updateError.message : "Please try again.",
        tone: "error",
      })
    }
  }

  const assignVendor = async (projectId: string, vendorId: string) => {
    try {
      await adminApi.assignVendor(projectId, vendorId)
      pushToast({
        title: "Vendor assigned",
        description: "The vendor is now attached to this project.",
        tone: "success",
      })
      await reload()
    } catch (assignmentError) {
      pushToast({
        title: "Unable to assign vendor",
        description: assignmentError instanceof Error ? assignmentError.message : "Please try again.",
        tone: "error",
      })
    }
  }

  const assignStaff = async (
    projectId: string,
    userId: string,
    role: "PRIMARY" | "SUPPORTING",
  ) => {
    try {
      await adminApi.assignProjectStaff(projectId, { userId, role })
      pushToast({
        title: "Staff assigned",
        description: `${role === "PRIMARY" ? "Primary owner" : "Supporting staff"} updated successfully.`,
        tone: "success",
      })
      await reload()
    } catch (assignmentError) {
      pushToast({
        title: "Unable to assign staff",
        description: assignmentError instanceof Error ? assignmentError.message : "Please try again.",
        tone: "error",
      })
    }
  }

  const createUpdate = async (
    projectId: string,
    payload: { stage: ProjectUpdate["stage"]; title: string; body?: string; isInternal?: boolean },
  ) => {
    try {
      await adminApi.createProjectUpdate(projectId, payload)
      pushToast({
        title: payload.isInternal ? "Internal update logged" : "Client update sent",
        description: payload.isInternal
          ? "The update was saved for the internal team."
          : "The client has been notified of the latest project progress.",
        tone: "success",
      })
      await reload()
    } catch (updateError) {
      pushToast({
        title: "Unable to publish update",
        description: updateError instanceof Error ? updateError.message : "Please try again.",
        tone: "error",
      })
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
        title="Projects unavailable"
        description={error ?? "Unable to load project operations."}
      />
    )
  }

  return (
    <DashboardPage>
      <PageHero
        eyebrow="Projects"
        title="Run confirmed events from signed contract through completion."
        description="Each project shows ownership, vendor coverage, staged payments, and the next operational action so the handoff from booking to execution stays visible."
        action={{ label: "Open Payments", href: "/admin/payments" }}
        secondaryAction={{ label: "View Contracts", href: "/admin/contracts" }}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active Projects" value={metrics.active} hint="Planning, preparation, and execution." />
        <MetricCard label="Live Execution" value={metrics.execution} hint="Projects currently on event delivery." />
        <MetricCard label="Completed" value={metrics.completed} hint="Projects closed successfully." />
        <MetricCard label="Pending Payments" value={metrics.pendingPayments} hint="Outstanding milestones across visible projects." />
      </div>

      {error ? (
        <InlineNotice
          tone="warning"
          title="Showing the last successful project snapshot"
          description={`${error} Filters, ownership changes, and project updates will continue working while the next refresh retries in the background.`}
        />
      ) : null}

      <Surface
        title="Project Operations"
        description="Search confirmed projects, assign internal ownership and vendors, move status forward, and publish project updates for the client or internal team."
        headerAction={
          <div className="flex flex-wrap items-center gap-3">
            {isRefreshing ? <div className={styles.softPill}>Refreshing</div> : null}
            <input
              value={search}
              onChange={(event) => {
                setPage(1)
                setSearch(event.target.value)
              }}
              placeholder="Search project, client, or service"
              className="min-h-11 rounded-[16px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] px-4 text-sm text-[var(--dashboard-text)] outline-none"
            />
            <input
              value={location}
              onChange={(event) => {
                setPage(1)
                setLocation(event.target.value)
              }}
              placeholder="Location"
              className="min-h-11 rounded-[16px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] px-4 text-sm text-[var(--dashboard-text)] outline-none"
            />
            <select
              className="min-h-11 rounded-[16px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] px-4 text-sm text-[var(--dashboard-text)] outline-none"
              value={status}
              onChange={(event) => {
                setPage(1)
                setStatus(event.target.value)
              }}
            >
              <option value="">All statuses</option>
              {projectStatuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        }
      >
        {data.projects.items.length ? (
          <VirtualizedList
            items={data.projects.items}
            itemHeight={620}
            height={Math.min(1040, Math.max(420, data.projects.items.length * 620))}
            overscan={2}
            contentClassName="space-y-4"
            getKey={(project) => project.id}
            ariaLabel="Project operations list"
            renderItem={(project) => (
              <ProjectCard
                project={project}
                users={data.users}
                vendors={data.vendors}
                onAssignStaff={assignStaff}
                onAssignVendor={assignVendor}
                onCreateUpdate={createUpdate}
                onUpdateProject={updateProject}
              />
            )}
          />
        ) : (
          <EmptyState
            title="No projects match this view"
            description="Signed contracts create projects automatically. Clear the filters or wait for the next project handoff."
          />
        )}

        <div className="mt-6 flex flex-col gap-4 text-sm text-[var(--dashboard-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing {data.projects.items.length} of {data.projects.meta.total} projects
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
            <span>Page {data.projects.meta.page}</span>
            <button
              type="button"
              disabled={page * data.projects.meta.limit >= data.projects.meta.total}
              onClick={() => setPage((current) => current + 1)}
              className={`${styles.secondaryButton} inline-flex min-h-10 items-center rounded-full px-4 text-sm`}
            >
              Next
            </button>
          </div>
        </div>
      </Surface>
    </DashboardPage>
  )
}
