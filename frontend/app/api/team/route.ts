import { NextResponse } from "next/server"
import { getPublishedTeamMembers } from "@/lib/team-store"

export const dynamic = "force-dynamic"

export async function GET() {
  const members = await getPublishedTeamMembers()

  return NextResponse.json(members)
}
