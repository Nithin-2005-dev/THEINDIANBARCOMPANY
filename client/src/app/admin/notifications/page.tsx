"use client"

import { useEffect, useState } from "react"
import {
  DashboardPage,
  ErrorState,
  PageHero,
  SkeletonSurface,
} from "@/components/dashboard/DashboardPrimitives"
import { NotificationsCenter } from "@/components/dashboard/NotificationsCenter"
import { adminApi, AdminApiError } from "@/lib/admin-client"
import { useRealtimeStream } from "@/lib/realtime"
import type { AppNotification } from "@/types/admin"

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadNotifications = async () => {
    try {
      const data = await adminApi.listNotifications()
      setNotifications(data)
      setError(null)
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Unable to load notifications.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadNotifications()
  }, [])

  useRealtimeStream({
    role: "admin",
    enabled: true,
    onEvent: (event) => {
      if (event.type.startsWith("notification.")) {
        void loadNotifications()
      }
    },
  })

  if (isLoading) {
    return (
      <DashboardPage>
        <SkeletonSurface />
      </DashboardPage>
    )
  }

  if (error) {
    return <ErrorState title="Notifications unavailable" description={error} />
  }

  return (
    <DashboardPage>
      <PageHero
        eyebrow="Notifications"
        title="Operational alerts, message activity, and system-driven reminders."
        description="This stream centralizes new bookings, payment events, client communication, and status changes that need admin attention."
      />

      <NotificationsCenter
        title="Notification Center"
        description="Grouped activity keeps unread approvals, messages, and ops alerts easy to scan."
        notifications={notifications}
        onMarkRead={async (id) => {
          await adminApi.markNotificationRead(id)
          setNotifications((current) =>
            current.map((item) =>
              item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
            ),
          )
        }}
        emptyTitle="No notifications yet"
        emptyDescription="Important message activity, booking changes, and internal alerts will appear here."
      />
    </DashboardPage>
  )
}
