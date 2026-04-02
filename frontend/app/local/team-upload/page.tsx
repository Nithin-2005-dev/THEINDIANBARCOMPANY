import { headers } from "next/headers"
import { notFound } from "next/navigation"
import LocalTeamManager from "./LocalTeamManager"
import { isLocalHost } from "@/lib/local-only"
import { getAdminTeamMembers } from "@/lib/team-store"

export const dynamic = "force-dynamic"

export default async function LocalTeamUploadPage() {
  const requestHeaders = await headers()

  if (!isLocalHost(requestHeaders.get("host"))) {
    notFound()
  }

  const members = await getAdminTeamMembers()

  return <LocalTeamManager initialMembers={members} />
}
