"use client"

import { FormEvent, useState } from "react"
import AdminPageHeader from "@/components/admin/AdminPageHeader"
import EmptyState from "@/components/admin/EmptyState"
import Panel from "@/components/admin/Panel"
import StatusBadge from "@/components/admin/StatusBadge"
import { useAdminResource } from "@/components/admin/useAdminResource"
import { adminApi } from "@/lib/admin-client"

export default function AdminVendorsPage() {
  const [form, setForm] = useState({
    name: "",
    serviceType: "",
    phone: "",
    email: "",
    pricingInfo: "",
    notes: "",
    enablePortalAccess: true,
  })

  const { data, error, isLoading, reload } = useAdminResource(
    () => adminApi.listVendors(new URLSearchParams({ page: "1", limit: "50" })),
    [],
  )

  const createVendor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await adminApi.createVendor({
      ...form,
      phone: form.phone || undefined,
      email: form.email || undefined,
      pricingInfo: form.pricingInfo || undefined,
      notes: form.notes || undefined,
    })
    setForm({
      name: "",
      serviceType: "",
      phone: "",
      email: "",
      pricingInfo: "",
      notes: "",
      enablePortalAccess: true,
    })
    await reload()
  }

  if (isLoading) return <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 text-white/65">Loading vendors...</div>
  if (error || !data) return <EmptyState title="Vendors unavailable" description={error ?? "Unable to load vendors."} />

  return (
    <div>
      <AdminPageHeader title="Vendors" description="Maintain the service partner directory, vendor portal access, and assignment readiness." />
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Add Vendor">
          <form className="grid gap-3" onSubmit={createVendor}>
            {[
              ["name", "Vendor name"],
              ["serviceType", "Service type"],
              ["phone", "Phone"],
              ["email", "Email"],
              ["pricingInfo", "Pricing info"],
            ].map(([key, placeholder]) => (
              <input
                key={key}
                className="min-h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none"
                placeholder={placeholder}
                value={form[key as keyof typeof form] as string}
                onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
              />
            ))}
            <textarea
              className="min-h-28 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
              placeholder="Notes"
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-white/75">
              <input
                type="checkbox"
                checked={form.enablePortalAccess}
                onChange={(event) => setForm((current) => ({ ...current, enablePortalAccess: event.target.checked }))}
                className="accent-[#d4af37]"
              />
              Create or link a vendor portal account using this phone or email
            </label>
            <button type="submit" className="inline-flex min-h-12 items-center justify-center rounded-full bg-gradient-to-r from-[#d4af37] to-[#9a7b2f] px-6 text-xs font-medium uppercase tracking-[0.22em] text-black">Create vendor</button>
          </form>
        </Panel>

        <Panel title="Vendor Directory">
          <div className="space-y-3">
            {data.items.map((vendor) => (
              <div key={vendor.id} className="rounded-[22px] border border-white/8 bg-black/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-white/90">{vendor.name}</p>
                    <p className="mt-1 text-xs text-white/45">{vendor.serviceType}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge value={vendor.isAvailable ? "ACTIVE" : "BUSY"} />
                    {vendor.user ? <StatusBadge value="VENDOR" /> : null}
                  </div>
                </div>
                <p className="mt-3 text-xs text-white/45">{vendor.phone ?? "No phone"} | {vendor.email ?? "No email"}</p>
                <p className="mt-2 text-xs text-white/40">
                  Portal {vendor.user ? `enabled for ${vendor.user.name ?? vendor.user.email ?? vendor.user.phone ?? vendor.user.id}` : "not enabled"}
                </p>
                <p className="mt-2 text-xs text-white/40">{vendor.assignments?.length ?? 0} active project assignment(s)</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}
