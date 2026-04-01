"use client"

import { useEffect, useState } from "react"
import {
  DashboardPage,
  ErrorState,
  PageHero,
  SkeletonSurface,
} from "@/components/dashboard/DashboardPrimitives"
import { NotificationsCenter } from "@/components/dashboard/NotificationsCenter"
import { useRealtimeStream } from "@/lib/realtime"
import { staffApi, StaffApiError } from "@/lib/staff-client"
import type { StaffNotification } from "@/types/staff"

export default function StaffNotificationsPage() {
  const [notifications, setNotifications] = useState<StaffNotification[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadNotifications = async () => {
    try {
      const data = await staffApi.notifications()
      setNotifications(data)
      setError(null)
    } catch (err) {
      setError(err instanceof StaffApiError ? err.message : "Unable to load notifications.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadNotifications()
  }, [])

  useRealtimeStream({
    role: "staff",
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
        title="Client activity, task reminders, and project updates in one queue."
        description="Use the staff notification center to catch unread events quickly and jump straight into the relevant booking, task, or conversation."
      />

      <NotificationsCenter
        title="Notification Center"
        description="Grouped updates keep new client activity, assignments, and reminders in one queue."
        notifications={notifications}
        onMarkRead={async (id) => {
          await staffApi.markNotificationRead(id)
          setNotifications((current) =>
            current.map((item) =>
              item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
            ),
          )
        }}
        emptyTitle="No notifications yet"
        emptyDescription="Unread client messages, task reminders, and project updates will appear here."
      />
    </DashboardPage>
  )
}
