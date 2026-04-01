import { redirect } from "next/navigation"

export default async function VerifyOtpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; identifier?: string; phone?: string; email?: string; role?: string }>
}) {
  const params = await searchParams
  const next = new URLSearchParams()

  next.set("role", params.role ?? "client")
  next.set("step", "verify")

  const identifier = params.identifier ?? params.phone ?? params.email
  if (identifier) {
    next.set("identifier", identifier)
  }

  if (params.next) {
    next.set("next", params.next)
  }

  redirect(`/login?${next.toString()}`)
}
