import { redirect } from "next/navigation"
import { getRoleLoginPath } from "@/lib/auth-routes"

export default async function StaffLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const params = await searchParams
  redirect(getRoleLoginPath("STAFF", params.next))
}
