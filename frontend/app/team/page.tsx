import type { Metadata } from "next"
import TeamDirectory from "./TeamDirectory"
import { getPublishedTeamMembers } from "@/lib/team-store"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "The Bartenders (Team) | The Indian Bar Company",
  description:
    "Meet the leadership, trustees, and influencer partners behind The Indian Bar Company's premium bartending experiences.",
}

export default async function TeamPage() {
  const members = await getPublishedTeamMembers()

  return <TeamDirectory members={members} />
}
