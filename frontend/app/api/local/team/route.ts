import { NextResponse } from "next/server"
import { isLocalHost } from "@/lib/local-only"
import { getAdminTeamMembers, saveTeamMember } from "@/lib/team-store"
import type { TeamMemberMutationPayload } from "@/types/team"

export const dynamic = "force-dynamic"

function rejectIfNotLocal(request: Request) {
  if (!isLocalHost(request.headers.get("host"))) {
    return NextResponse.json({ error: "This route is available only on localhost." }, { status: 403 })
  }

  return null
}

export async function GET(request: Request) {
  const rejection = rejectIfNotLocal(request)
  if (rejection) return rejection

  const members = await getAdminTeamMembers()

  return NextResponse.json(members)
}

export async function POST(request: Request) {
  const rejection = rejectIfNotLocal(request)
  if (rejection) return rejection

  try {
    const payload = (await request.json()) as TeamMemberMutationPayload
    const member = await saveTeamMember(payload)

    return NextResponse.json(member)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save team member."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
