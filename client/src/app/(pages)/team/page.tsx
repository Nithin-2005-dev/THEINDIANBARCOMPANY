import type { Metadata } from "next"
import { getBackendApiUrlFromEnv } from "@/lib/backend-api-url"
import { buildMetadata } from "@/lib/seo"
import type { TeamMember } from "@/types/team"
import TeamDirectory from "./TeamDirectory"

export const metadata: Metadata = buildMetadata({
  title: "The Bartenders (Team)",
  description:
    "Meet the leadership, trustees, and influencer partners behind The Indian Bar's premium bartending experiences.",
  path: "/team",
  keywords: [
    "The Indian Bar team",
    "bartender team India",
    "hospitality leadership India",
    "event bar experts",
  ],
  image: "/images/martini/1.jpg",
})

async function getTeamMembers() {
  try {
    const response = await fetch(`${getBackendApiUrlFromEnv()}/team`, {
      cache: "no-store",
    })

    if (!response.ok) {
      return []
    }

    return (await response.json()) as TeamMember[]
  } catch {
    return []
  }
}

export default async function TeamPage() {
  const members = await getTeamMembers()

  return <TeamDirectory members={members} />
}
