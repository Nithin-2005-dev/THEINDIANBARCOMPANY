import { NextRequest, NextResponse } from "next/server"
import {
  clearClientSessionCookies,
  getBackendApiUrl,
  getClientSession,
  setClientSessionCookies,
} from "@/lib/client-auth"
import { createSseProxyResponse } from "@/lib/sse-proxy"

type ProxyMethod = "GET" | "POST" | "PATCH" | "DELETE"

async function refreshAccessToken() {
  const session = await getClientSession()

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
    await clearClientSessionCookies()
    return null
  }

  const data = await response.json()

  if (data.user?.role !== "CLIENT") {
    await clearClientSessionCookies()
    return null
  }

  await setClientSessionCookies({
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
  const session = await getClientSession()
  let accessToken = session.accessToken
  const requestBody = method === "GET" ? undefined : await request.text()

  const makeRequest = async (token?: string) => {
    return fetch(`${getBackendApiUrl()}${path}`, {
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
    await clearClientSessionCookies()
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

async function proxyStreamRequest(
  _request: NextRequest,
  path: string,
  requireAuth = true,
) {
  const session = await getClientSession()
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
      signal: _request.signal,
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
    await clearClientSessionCookies()
  }

  return createSseProxyResponse(response)
}

export async function proxyClientGet(request: NextRequest, path: string, requireAuth = true) {
  return proxyRequest(request, path, "GET", requireAuth)
}

export async function proxyClientPost(request: NextRequest, path: string, requireAuth = true) {
  return proxyRequest(request, path, "POST", requireAuth)
}

export async function proxyClientPatch(request: NextRequest, path: string, requireAuth = true) {
  return proxyRequest(request, path, "PATCH", requireAuth)
}

export async function proxyClientDelete(request: NextRequest, path: string, requireAuth = true) {
  return proxyRequest(request, path, "DELETE", requireAuth)
}

export async function proxyClientEventStream(
  request: NextRequest,
  path: string,
  requireAuth = true,
) {
  return proxyStreamRequest(request, path, requireAuth)
}
