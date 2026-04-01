"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  DashboardShell,
  type DashboardHeaderContext,
  type DashboardNavSection,
} from "@/components/dashboard/DashboardShell"
import {
  DashboardScreenLoader,
  StatusIndicator,
} from "@/components/dashboard/DashboardPrimitives"
import {
  BookingsIcon,
  MessagesIcon,
  NotificationsIcon,
  PaymentsIcon,
  ProjectsIcon,
  TasksIcon,
} from "@/components/dashboard/icons"
import { useToast } from "@/components/dashboard/ToastProvider"
import { apiRequest, showApiErrorToast } from "@/lib/api"
import { getRoleLoginPath } from "@/lib/auth-routes"
import { canManageFinance } from "@/lib/roles"
import { getRealtimeConnectionLabel, useRealtimeStream } from "@/lib/realtime"
import { staffApi } from "@/lib/staff-client"
import type { AdminUser } from "@/types/admin"

export default function StaffShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { pushToast } = useToast()
  const [user, setUser] = useState<AdminUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notificationCount, setNotificationCount] = useState(0)
  const [chatUnreadCount, setChatUnreadCount] = useState(0)

  useEffect(() => {
    staffApi
      .me()
      .then((nextUser) => setUser(nextUser as AdminUser))
      .catch(() => {
        router.replace(getRoleLoginPath("STAFF", pathname))
      })
      .finally(() => setIsLoading(false))
  }, [pathname, router])

  const refreshBadges = useCallback(async () => {
    if (!user) return

    try {
      const [notifications, inbox] = await Promise.all([
        staffApi.notifications(),
        staffApi.inbox(),
      ])

      setNotificationCount(notifications.filter((item) => !item.readAt).length)
      setChatUnreadCount(
        inbox.reduce((sum, thread) => sum + (thread.unreadCount ?? 0), 0),
      )
    } catch {
      // Keep shell navigation resilient if badge refresh fails.
    }
  }, [user])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshBadges()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [refreshBadges])

  const { connectionState } = useRealtimeStream({
    role: "staff",
    enabled: Boolean(user),
    onEvent: (event) => {
      if (
        event.type.startsWith("notification.") ||
        event.type.startsWith("message.")
      ) {
        void refreshBadges()
      }
    },
  })

  const connectionTone =
    connectionState === "open"
      ? "success"
      : connectionState === "connecting" || connectionState === "reconnecting"
        ? "warning"
        : "danger"

  const sections = useMemo<DashboardNavSection[]>(() => {
    const workspace = [
      { href: "/staff", label: "Overview", icon: ProjectsIcon },
      {
        href: "/staff/bookings",
        label: "Bookings",
        icon: BookingsIcon,
        matchPrefixes: ["/staff/bookings", "/staff/leads"],
      },
      { href: "/staff/projects", label: "Projects", icon: ProjectsIcon },
      { href: "/staff/tasks", label: "Tasks", icon: TasksIcon },
      {
        href: "/staff/chat",
        label: "Chat",
        icon: MessagesIcon,
        badge: chatUnreadCount || undefined,
      },
    ]

    const tools = [
      { href: "/staff/notifications", label: "Notifications", icon: NotificationsIcon, badge: notificationCount || undefined },
      { href: "/staff/inbox", label: "Inbox", icon: MessagesIcon },
    ]

    if (canManageFinance(user?.role)) {
      tools.push({ href: "/staff/payments", label: "Payments", icon: PaymentsIcon })
    }

    return [
      { label: "Workspace", items: workspace },
      { label: "Tools", items: tools },
    ]
  }, [chatUnreadCount, notificationCount, user?.role])

  const headerContext = useMemo<DashboardHeaderContext>(() => {
    if (pathname === "/staff") {
      return {
        title: "Staff overview",
        description:
          "Stay aligned on assigned bookings, delivery work, communication, and urgent follow-ups.",
        actions: [
          { label: "Open bookings", href: "/staff/bookings", tone: "primary", icon: BookingsIcon },
          { label: "Projects", href: "/staff/projects", tone: "secondary", icon: ProjectsIcon },
          { label: "Tasks", href: "/staff/tasks", tone: "ghost", icon: TasksIcon },
        ],
      }
    }

    if (pathname.startsWith("/staff/bookings") || pathname.startsWith("/staff/leads")) {
      return {
        title: "Assigned bookings",
        description:
          "Review the event brief, next actions, payment context, and client communication.",
        actions: [
          { label: "Projects", href: "/staff/projects", tone: "secondary", icon: ProjectsIcon },
          { label: "Chat", href: "/staff/chat", tone: "ghost", icon: MessagesIcon },
        ],
      }
    }

    if (pathname.startsWith("/staff/tasks")) {
      return {
        title: "Task execution",
        description:
          "Keep work moving with less switching between projects, inbox updates, and booking context.",
        actions: [
          { label: "Bookings", href: "/staff/bookings", tone: "secondary", icon: BookingsIcon },
          { label: "Inbox", href: "/staff/inbox", tone: "ghost", icon: MessagesIcon },
        ],
      }
    }

    return {
      title: "Staff workspace",
      description:
        "Move between delivery work, messaging, and alerts with a cleaner, more reliable layout.",
      actions: [
        { label: "Bookings", href: "/staff/bookings", tone: "primary", icon: BookingsIcon },
        { label: "Projects", href: "/staff/projects", tone: "secondary", icon: ProjectsIcon },
        { label: "Notifications", href: "/staff/notifications", tone: "ghost", icon: NotificationsIcon },
      ],
    }
  }, [pathname])

  if (isLoading) {
    return <DashboardScreenLoader metricCount={4} />
  }

  return (
    <DashboardShell
      role="staff"
      brand="The Indian Bar Company"
      product="Staff Workspace"
      sections={sections}
      user={{
        name: user?.name ?? "Staff User",
        subtitle: user?.email ?? user?.phone ?? user?.role ?? "Internal access",
      }}
      utility={
        <StatusIndicator tone={connectionTone}>
          {getRealtimeConnectionLabel(connectionState)}
        </StatusIndicator>
      }
      headerContext={headerContext}
      onLogout={async () => {
        try {
          await apiRequest({
            url: "/staff/auth/logout",
            method: "POST",
          })
        } catch (error) {
          showApiErrorToast({ pushToast }, error, "Unable to log out cleanly")
        }
        router.replace(getRoleLoginPath("STAFF"))
      }}
    >
      {children}
    </DashboardShell>
  )
}
