import { redirect } from "next/navigation"
import { getRoleLoginPath } from "@/lib/auth-routes"

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const params = await searchParams
  redirect(getRoleLoginPath("ADMIN", params.next))
}
