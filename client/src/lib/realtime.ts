"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type RealtimeRole = "admin" | "staff" | "client"
export type RealtimeConnectionState =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "closed"

export type RealtimeEvent = {
  id: string
  type: string
  occurredAt: string
  payload: Record<string, unknown>
}

const HEARTBEAT_TIMEOUT_MS = 45_000
const MAX_RECONNECT_DELAY_MS = 10_000

function getReconnectDelay(attempt: number) {
  return Math.min(1_000 * 2 ** Math.max(attempt - 1, 0), MAX_RECONNECT_DELAY_MS)
}

export function getRealtimeConnectionLabel(state: RealtimeConnectionState) {
  switch (state) {
    case "open":
      return "Connected"
    case "connecting":
      return "Connecting"
    case "reconnecting":
      return "Reconnecting"
    case "closed":
      return "Disconnected"
    default:
      return "Offline"
  }
}

export function useRealtimeStream({
  role,
  enabled = true,
  onEvent,
}: {
  role: RealtimeRole
  enabled?: boolean
  onEvent?: (event: RealtimeEvent) => void
}) {
  const [connectionState, setConnectionState] =
    useState<RealtimeConnectionState>("idle")
  const onEventRef = useRef(onEvent)
  const connectionStateRef = useRef<RealtimeConnectionState>("idle")
  const sourceRef = useRef<EventSource | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const heartbeatTimerRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)
  const lastEventAtRef = useRef<number>(0)
  const isDisposedRef = useRef(false)

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  const updateConnectionState = useCallback((state: RealtimeConnectionState) => {
    connectionStateRef.current = state
    setConnectionState(state)
  }, [])

  useEffect(() => {
    if (!enabled) {
      isDisposedRef.current = true
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      if (heartbeatTimerRef.current) {
        window.clearInterval(heartbeatTimerRef.current)
        heartbeatTimerRef.current = null
      }
      sourceRef.current?.close()
      sourceRef.current = null
      queueMicrotask(() => {
        if (isDisposedRef.current) {
          updateConnectionState("idle")
        }
      })
      return
    }

    isDisposedRef.current = false

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    const closeSource = () => {
      sourceRef.current?.close()
      sourceRef.current = null
    }

    const scheduleReconnect = (reason: string) => {
      if (isDisposedRef.current || reconnectTimerRef.current) {
        return
      }

      closeSource()
      reconnectAttemptRef.current += 1
      const delay = getReconnectDelay(reconnectAttemptRef.current)
      updateConnectionState("reconnecting")
      console.warn(`[realtime:${role}] reconnecting in ${delay}ms`, { reason })
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null
        connect()
      }, delay)
    }

    const connect = () => {
      clearReconnectTimer()
      closeSource()
      updateConnectionState(
        reconnectAttemptRef.current > 0 ? "reconnecting" : "connecting",
      )

      const source = new EventSource(`/api/v1/${role}/realtime/stream`, {
        withCredentials: true,
      })

      sourceRef.current = source
      console.info(`[realtime:${role}] opening stream`)

      source.onopen = () => {
        reconnectAttemptRef.current = 0
        lastEventAtRef.current = Date.now()
        updateConnectionState("open")
        console.info(`[realtime:${role}] stream connected`)
      }

      source.onmessage = (message) => {
        lastEventAtRef.current = Date.now()

        try {
          const event = JSON.parse(message.data) as RealtimeEvent
          if (event.type === "system.connected" || event.type === "system.heartbeat") {
            updateConnectionState("open")
          }
          console.debug(`[realtime:${role}] event received`, {
            type: event.type,
            id: event.id,
          })
          onEventRef.current?.(event)
        } catch (error) {
          console.warn(`[realtime:${role}] malformed event payload`, error)
        }
      }

      source.onerror = () => {
        console.warn(`[realtime:${role}] stream error`, {
          readyState: source.readyState,
        })
        scheduleReconnect(
          source.readyState === EventSource.CLOSED
            ? "event-source-closed"
            : "event-source-error",
        )
      }
    }

    lastEventAtRef.current = Date.now()
    heartbeatTimerRef.current = window.setInterval(() => {
      if (isDisposedRef.current || connectionStateRef.current !== "open") {
        return
      }

      if (Date.now() - lastEventAtRef.current > HEARTBEAT_TIMEOUT_MS) {
        console.warn(`[realtime:${role}] heartbeat timeout`)
        scheduleReconnect("heartbeat-timeout")
      }
    }, 10_000)

    connect()

    return () => {
      isDisposedRef.current = true
      clearReconnectTimer()
      if (heartbeatTimerRef.current) {
        window.clearInterval(heartbeatTimerRef.current)
        heartbeatTimerRef.current = null
      }
      closeSource()
      console.info(`[realtime:${role}] stream closed`)
      queueMicrotask(() => {
        if (isDisposedRef.current) {
          updateConnectionState("closed")
        }
      })
    }
  }, [enabled, role, updateConnectionState])

  return {
    connectionState,
    isLive: connectionState === "open",
  }
}
