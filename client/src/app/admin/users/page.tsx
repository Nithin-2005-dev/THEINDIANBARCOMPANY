"use client"

import { FormEvent, useState } from "react"
import AdminPageHeader from "@/components/admin/AdminPageHeader"
import EmptyState from "@/components/admin/EmptyState"
import Panel from "@/components/admin/Panel"
import StatusBadge from "@/components/admin/StatusBadge"
import { useAdminResource } from "@/components/admin/useAdminResource"
import { adminApi } from "@/lib/admin-client"
import { formatDate } from "@/lib/admin-format"
import type { AdminRole } from "@/types/admin"

const staffRoles: Array<Extract<AdminRole, "ADMIN" | "SALES" | "OPS" | "FINANCE">> = [
  "ADMIN",
  "SALES",
  "OPS",
  "FINANCE",
]

const formFieldClassName =
  "min-h-12 min-w-0 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none"

export default function AdminUsersPage() {
  const [form, setForm] = useState<{
    name: string
    phone: string
    email: string
    role: typeof staffRoles[number]
  }>({
    name: "",
    phone: "",
    email: "",
    role: "OPS",
  })

  const { data, error, isLoading, reload } = useAdminResource(
    () => adminApi.listUsers(new URLSearchParams({ page: "1", limit: "50" })),
    [],
  )

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await adminApi.createStaffUser({
      name: form.name,
      role: form.role,
      phone: form.phone || undefined,
      email: form.email || undefined,
    })
    setForm({ name: "", phone: "", email: "", role: "OPS" })
    await reload()
  }

  const updateRole = async (userId: string, role: typeof staffRoles[number]) => {
    await adminApi.updateUserRole(userId, role)
    await reload()
  }

  const updateStatus = async (userId: string, isActive: boolean) => {
    await adminApi.updateUserStatus(userId, isActive)
    await reload()
  }

  if (isLoading) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 text-white/65">
        Loading users...
      </div>
    )
  }

  if (error || !data) {
    return (
      <EmptyState
        title="Users unavailable"
        description={error ?? "Unable to load users."}
      />
    )
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Users"
        description="Create internal accounts, adjust roles, and activate or deactivate operational access."
      />

      <Panel>
        <form
          className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,180px)_auto]"
          onSubmit={createUser}
        >
          <input
            className={formFieldClassName}
            placeholder="Full name"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
          />
          <input
            className={formFieldClassName}
            placeholder="+91 98765 43210"
            value={form.phone}
            onChange={(event) =>
              setForm((current) => ({ ...current, phone: event.target.value }))
            }
          />
          <input
            className={formFieldClassName}
            placeholder="ops@theindianbarcompany.com"
            value={form.email}
            onChange={(event) =>
              setForm((current) => ({ ...current, email: event.target.value }))
            }
          />
          <select
            className={formFieldClassName}
            value={form.role}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                role: event.target.value as (typeof staffRoles)[number],
              }))
            }
          >
            {staffRoles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-[#d4af37] to-[#9a7b2f] px-6 text-xs font-medium uppercase tracking-[0.22em] text-black md:col-span-2 xl:col-span-1 xl:w-auto"
          >
            Create staff
          </button>
        </form>

        <div className="space-y-3">
          {data.items.map((user) => (
            <div
              key={user.id}
              className="rounded-[22px] border border-white/8 bg-black/10 p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="break-words text-white/90">
                    {user.name ?? "Unnamed user"}
                  </p>
                  <p className="mt-1 break-words text-xs leading-5 text-white/45">
                    {user.phone ?? "No phone"} · {user.email ?? "No email"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                  <StatusBadge value={user.role} />
                  <span className="text-xs leading-5 text-white/45">
                    Created {formatDate(user.createdAt)}
                  </span>
                </div>
              </div>

              {staffRoles.includes(user.role as (typeof staffRoles)[number]) ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:max-w-[24rem]">
                  <select
                    className="min-h-10 min-w-0 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-white outline-none"
                    value={user.role}
                    onChange={(event) =>
                      updateRole(
                        user.id,
                        event.target.value as (typeof staffRoles)[number],
                      )
                    }
                  >
                    {staffRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => updateStatus(user.id, !user.isActive)}
                    className="min-h-10 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs uppercase tracking-[0.18em] text-white"
                  >
                    {user.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}
