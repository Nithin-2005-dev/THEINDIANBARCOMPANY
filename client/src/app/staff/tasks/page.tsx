"use client"

import Link from "next/link"
import EmptyState from "@/components/admin/EmptyState"
import Panel from "@/components/admin/Panel"
import StatusBadge from "@/components/admin/StatusBadge"
import { useAdminResource } from "@/components/admin/useAdminResource"
import { formatDateOnly } from "@/lib/admin-format"
import { staffApi } from "@/lib/staff-client"

export default function StaffTasksPage() {
  const { data, error, isLoading } = useAdminResource(() => staffApi.dashboard(), [])

  if (isLoading) {
    return <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 text-white/65">Loading assigned tasks...</div>
  }

  if (error || !data) {
    return <EmptyState title="Tasks unavailable" description={error ?? "Unable to load assigned tasks."} />
  }

  const columns = [
    ["Pending", data.tasks.filter((task) => task.status === "PENDING")],
    ["In Progress", data.tasks.filter((task) => task.status === "IN_PROGRESS")],
    ["Blocked", data.tasks.filter((task) => task.status === "BLOCKED")],
    ["Done", data.tasks.filter((task) => task.status === "DONE")],
  ] as const

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-[#d4af37]/80">Execution Engine</p>
        <h1 className="mt-3 font-serif text-4xl text-white/95">Assigned Tasks</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/55">
          Monitor deadlines, blockers, and completion across the projects you own.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-4">
        {columns.map(([title, tasks]) => (
          <Panel key={title} title={title} description={`${tasks.length} task(s)`}>
            <div className="space-y-3">
              {tasks.length ? (
                tasks.map((task) => (
                  <Link
                    key={task.id}
                    href={`/staff/projects/${task.projectId}`}
                    className="block rounded-[20px] border border-white/8 bg-black/10 p-4 transition hover:border-[#d4af37]/30"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-white/92">{task.title}</p>
                      <StatusBadge value={task.status} />
                    </div>
                    <p className="mt-2 text-xs text-white/45">{task.priority} priority</p>
                    <p className="mt-2 text-xs text-white/40">Due {formatDateOnly(task.dueDate)}</p>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-white/55">No tasks in this stage.</p>
              )}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  )
}
