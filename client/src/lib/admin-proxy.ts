import { NextRequest, NextResponse } from "next/server"
import {
  clearAdminSessionCookies,
  getAdminSession,
  getBackendApiUrl,
  setAdminSessionCookies,
} from "@/lib/admin-auth"
import { createSseProxyResponse } from "@/lib/sse-proxy"

type ProxyMethod = "GET" | "POST" | "PATCH" | "DELETE"

async function refreshAccessToken() {
  const session = await getAdminSession()

  if (!session.refreshToken || !session.deviceFingerprint) {
    return null
  }

  const response = await fetch(`${getBackendApiUrl()}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      refreshToken: session.refreshToken,
      deviceFingerprint: session.deviceFingerprint,
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    await clearAdminSessionCookies()
    return null
  }

  const data = await response.json()

  await setAdminSessionCookies({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    sessionId: data.session?.id,
    deviceFingerprint: session.deviceFingerprint,
  })

  return data.accessToken as string
}

async function proxyRequest(
  request: NextRequest,
  path: string,
  method: ProxyMethod,
  requireAuth = true,
) {
  const session = await getAdminSession()
  let accessToken = session.accessToken
  const requestBody = method === "GET" ? undefined : await request.text()

  const makeRequest = async (token?: string) => {
    const response = await fetch(`${getBackendApiUrl()}${path}`, {
      method,
      headers: {
        ...(requireAuth && token ? { Authorization: `Bearer ${token}` } : {}),
        ...(request.headers.get("accept")
          ? { Accept: request.headers.get("accept") as string }
          : {}),
        ...(request.headers.get("content-type")
          ? { "Content-Type": request.headers.get("content-type") as string }
          : {}),
      },
      body: requestBody,
      cache: "no-store",
    })

    return response
  }

  let response = await makeRequest(accessToken)

  if (requireAuth && response.status === 401) {
    const refreshedToken = await refreshAccessToken()
    if (!refreshedToken) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    accessToken = refreshedToken
    response = await makeRequest(accessToken)
  }

  if (response.status === 401 || response.status === 403) {
    await clearAdminSessionCookies()
  }

  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("text/event-stream")) {
    return createSseProxyResponse(response)
  }

  const text = await response.text()

  return new NextResponse(text, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/json",
    },
  })
}

async function proxyStreamRequest(request: NextRequest, path: string, requireAuth = true) {
  const session = await getAdminSession()
  let accessToken = session.accessToken

  const makeRequest = async (token?: string) =>
    fetch(`${getBackendApiUrl()}${path}`, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
        ...(requireAuth && token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
      signal: request.signal,
    })

  let response = await makeRequest(accessToken)

  if (requireAuth && response.status === 401) {
    const refreshedToken = await refreshAccessToken()
    if (!refreshedToken) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    accessToken = refreshedToken
    response = await makeRequest(accessToken)
  }

  if (response.status === 401 || response.status === 403) {
    await clearAdminSessionCookies()
  }

  return createSseProxyResponse(response)
}

export async function proxyGet(request: NextRequest, path: string, requireAuth = true) {
  return proxyRequest(request, path, "GET", requireAuth)
}

export async function proxyPost(request: NextRequest, path: string, requireAuth = true) {
  return proxyRequest(request, path, "POST", requireAuth)
}

export async function proxyPatch(request: NextRequest, path: string, requireAuth = true) {
  return proxyRequest(request, path, "PATCH", requireAuth)
}

export async function proxyDelete(request: NextRequest, path: string, requireAuth = true) {
  return proxyRequest(request, path, "DELETE", requireAuth)
}

export async function proxyAdminEventStream(
  request: NextRequest,
  path: string,
  requireAuth = true,
) {
  return proxyStreamRequest(request, path, requireAuth)
}
