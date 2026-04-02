import { NextResponse } from "next/server"
import { isLocalHost } from "@/lib/local-only"
import { deleteTeamMember } from "@/lib/team-store"

export const dynamic = "force-dynamic"

function rejectIfNotLocal(request: Request) {
  if (!isLocalHost(request.headers.get("host"))) {
    return NextResponse.json({ error: "This route is available only on localhost." }, { status: 403 })
  }

  return null
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const rejection = rejectIfNotLocal(request)
  if (rejection) return rejection

  try {
    const { id } = await context.params
    const deleted = await deleteTeamMember(decodeURIComponent(id))

    return NextResponse.json({ deleted })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete team member."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
