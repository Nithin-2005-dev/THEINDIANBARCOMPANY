"use client"

import { useEffect, useState } from "react"
import PortalShell from "@/components/portal/PortalShell"
import {
  DashboardPage,
  ErrorState,
  PageHero,
  SkeletonSurface,
} from "@/components/dashboard/DashboardPrimitives"
import { NotificationsCenter } from "@/components/dashboard/NotificationsCenter"
import {
  fetchPortalDashboard,
  fetchPortalNotifications,
  markNotificationRead,
  PortalApiError,
} from "@/lib/client-portal"
import { useRealtimeStream } from "@/lib/realtime"
import type { PortalNotification } from "@/types/client-portal"

export default function CustomerNotificationsClient() {
  const [notifications, setNotifications] = useState<PortalNotification[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadNotifications = async () => {
    try {
      const notificationData = await fetchPortalNotifications()
      setNotifications(notificationData)
      setError(null)
    } catch (err) {
      setError(
        err instanceof PortalApiError ? err.message : "Unable to load notifications.",
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadNotifications()
  }, [])

  useRealtimeStream({
    role: "client",
    enabled: true,
    onEvent: (event) => {
      if (event.type.startsWith("notification.")) {
        void loadNotifications()
      }
    },
  })

  return (
    <PortalShell>
        <DashboardPage>
        <PageHero
          eyebrow="Notifications"
          title="Every important event update in one place."
          description="Proposal alerts, payment reminders, messages, progress changes, and event reminders appear here in real time."
        />

        {isLoading ? (
          <SkeletonSurface />
        ) : error ? (
          <ErrorState title="Notifications unavailable" description={error} />
        ) : (
          <NotificationsCenter
            title="Notification Center"
            description="Open the linked action or mark items as read as you work through them."
            notifications={notifications}
            onMarkRead={async (id) => {
              await markNotificationRead(id)
              setNotifications((current) =>
                current.map((item) =>
                  item.id === id
                    ? { ...item, readAt: new Date().toISOString() }
                    : item,
                ),
              )
            }}
            emptyTitle="No notifications yet"
            emptyDescription="Important updates about proposals, payments, and event execution will appear here."
          />
        )}
        </DashboardPage>
    </PortalShell>
  )
}
