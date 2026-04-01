"use client"

import { useState } from "react"
import Link from "next/link"
import EmptyState from "@/components/admin/EmptyState"
import Panel from "@/components/admin/Panel"
import StatusBadge from "@/components/admin/StatusBadge"
import { useAdminResource } from "@/components/admin/useAdminResource"
import { formatDateOnly } from "@/lib/admin-format"
import { staffApi } from "@/lib/staff-client"

export default function StaffProjectsPage() {
  const [status, setStatus] = useState("")
  const [search, setSearch] = useState("")

  const { data, error, isLoading } = useAdminResource(async () => {
    const params = new URLSearchParams({ page: "1", limit: "100" })
    if (status) params.set("status", status)
    if (search.trim()) params.set("search", search.trim())
    return staffApi.listProjects(params)
  }, [status, search])

  if (isLoading) {
    return <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 text-white/65">Loading assigned projects...</div>
  }

  if (error || !data) {
    return <EmptyState title="Projects unavailable" description={error ?? "Unable to load assigned projects."} />
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-[#d4af37]/80">Operations Workspace</p>
        <h1 className="mt-3 font-serif text-4xl text-white/95">My Projects</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/55">
          Manage active events, execution stages, milestones, and delivery readiness across your assignments.
        </p>
      </div>

      <Panel title="Execution Pipeline" description="Projects assigned to your account.">
        <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
          <select
            className="min-h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            {["PLANNING", "PREPARATION", "EXECUTION", "COMPLETED", "CANCELLED"].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <input
            className="min-h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none"
            placeholder="Search by event, location, or proposal"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="mt-5 space-y-3">
          {data.items.length ? (
            data.items.map((project) => (
              <Link
                key={project.id}
                href={`/staff/projects/${project.id}`}
                className="block rounded-[24px] border border-white/8 bg-black/10 p-5 transition hover:border-[#d4af37]/30 hover:bg-white/[0.04]"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <p className="text-lg text-white/92">{project.contract?.proposal?.title ?? "Project"}</p>
                      <StatusBadge value={project.status} />
                    </div>
                    <p className="mt-2 text-sm text-white/45">
                      {project.contract?.proposal?.lead?.eventType ?? "Event"} | {project.contract?.proposal?.lead?.location ?? "Location pending"}
                    </p>
                    <p className="mt-2 text-xs text-white/40">
                      Event {formatDateOnly(project.contract?.proposal?.lead?.eventDate)} | Progress {project.progress}%
                    </p>
                  </div>
                  <div className="w-full max-w-xs">
                    <div className="h-2 rounded-full bg-white/8">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-[#d4af37] to-[#8d6f2b]"
                        style={{ width: `${Math.max(8, project.progress)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <p className="text-sm text-white/55">No projects match the current filters.</p>
          )}
        </div>
      </Panel>
    </div>
  )
}
