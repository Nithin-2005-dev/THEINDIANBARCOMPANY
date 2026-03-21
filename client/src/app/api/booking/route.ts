export async function POST(req: Request) {
  const data = await req.json()

  // Save booking later

  return Response.json({ success: true })
}