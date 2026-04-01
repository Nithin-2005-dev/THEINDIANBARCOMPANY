import { redirect } from "next/navigation"
import { getRoleLoginPath } from "@/lib/auth-routes"

export default async function VendorLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const params = await searchParams
  redirect(getRoleLoginPath("VENDOR", params.next))
}
