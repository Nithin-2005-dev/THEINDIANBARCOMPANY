import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import LocalTeamManager from "./LocalTeamManager"
import { isLocalHost } from "@/lib/local-only"
import { getAdminTeamMembers } from "@/lib/team-store"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Local Team Upload",
  description: "Local-only team management page for MongoDB Atlas updates.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      "max-image-preview": "none",
      "max-snippet": 0,
      "max-video-preview": 0,
    },
  },
}

export default async function LocalTeamUploadPage() {
  const requestHeaders = await headers()

  if (!isLocalHost(requestHeaders.get("host"))) {
    notFound()
  }

  const members = await getAdminTeamMembers()

  return <LocalTeamManager initialMembers={members} />
}
