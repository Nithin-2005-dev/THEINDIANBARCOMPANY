export function createSseProxyResponse(upstream: Response) {
  const contentType =
    upstream.headers.get("content-type") ??
    (upstream.ok ? "text/event-stream; charset=utf-8" : "application/json")

  const headers = new Headers()
  headers.set("Content-Type", contentType)

  if (contentType.includes("text/event-stream")) {
    headers.set("Cache-Control", "no-cache, no-transform")
    headers.set("Connection", "keep-alive")
    headers.set("Content-Encoding", "none")
    headers.set("X-Accel-Buffering", "no")
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  })
}
