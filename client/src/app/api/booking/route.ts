import { getBackendApiUrlFromEnv } from "@/lib/backend-api-url"

export async function POST(req: Request) {
  const data = await req.json()

  const response = await fetch(`${getBackendApiUrlFromEnv()}/public/bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
    cache: "no-store",
  })

  const text = await response.text()

  return new Response(text, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/json",
    },
  })
}
