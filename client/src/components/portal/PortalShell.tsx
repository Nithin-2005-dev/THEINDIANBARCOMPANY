"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { BookingThemeInput } from "@/components/booking-theme/booking-theme"
import { usePathname, useRouter } from "next/navigation"
import {
  DashboardShell,
  type DashboardHeaderContext,
  type DashboardNavSection,
} from "@/components/dashboard/DashboardShell"
import { StatusIndicator } from "@/components/dashboard/DashboardPrimitives"
import { useToast } from "@/components/dashboard/ToastProvider"
import {
  BookingsIcon,
  DocumentsIcon,
  MessagesIcon,
  NotificationsIcon,
  ProjectsIcon,
} from "@/components/dashboard/icons"
import { apiRequest, showApiErrorToast } from "@/lib/api"
import {
  fetchPortalInbox,
  fetchPortalNotifications,
  logoutPortal,
  PortalApiError,
} from "@/lib/client-portal"
import { getRoleLoginPath } from "@/lib/auth-routes"
import { getRealtimeConnectionLabel, useRealtimeStream } from "@/lib/realtime"

type ClientUser = {
  id: string
  name?: string | null
  phone?: string | null
  email?: string | null
  role?: string
}

export default function PortalShell({
  bookingTheme: _bookingTheme,
  children,
}: {
  bookingTheme?: BookingThemeInput
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { pushToast } = useToast()
  const [user, setUser] = useState<ClientUser | null>(null)
  const [notificationCount, setNotificationCount] = useState(0)
  const [chatUnreadCount, setChatUnreadCount] = useState(0)

  useEffect(() => {
    apiRequest<ClientUser>({
      url: "/client/auth/me",
    })
      .then(setUser)
      .catch(() => {
        router.replace(getRoleLoginPath("CLIENT", pathname))
      })
  }, [pathname, router])

  const refreshBadges = useCallback(async () => {
    try {
      const [notifications, inbox] = await Promise.all([
        fetchPortalNotifications(),
        fetchPortalInbox(),
      ])

      setNotificationCount(notifications.filter((item) => !item.readAt).length)
      setChatUnreadCount(
        inbox.reduce((sum, thread) => sum + (thread.unreadCount ?? 0), 0),
      )
    } catch (error) {
      if (error instanceof PortalApiError && error.status === 401) {
        router.replace(getRoleLoginPath("CLIENT", pathname))
      }
    }
  }, [pathname, router])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshBadges()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [refreshBadges])

  const { connectionState } = useRealtimeStream({
    role: "client",
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

  const sections = useMemo<DashboardNavSection[]>(
    () => [
      {
        label: "Client Portal",
        items: [
          { href: "/dashboard", label: "Overview", icon: ProjectsIcon },
          {
            href: "/dashboard/bookings",
            label: "Bookings",
            icon: BookingsIcon,
            matchPrefixes: ["/dashboard/bookings", "/dashboard/events", "/dashboard/receipts"],
          },
          {
            href: "/dashboard/chat",
            label: "Chat",
            icon: MessagesIcon,
            badge: chatUnreadCount || undefined,
          },
          {
            href: "/dashboard/notifications",
            label: "Notifications",
            icon: NotificationsIcon,
            badge: notificationCount || undefined,
          },
        ],
      },
    ],
    [chatUnreadCount, notificationCount],
  )

  const headerContext = useMemo<DashboardHeaderContext>(() => {
    if (pathname === "/dashboard") {
      return {
        title: "Client overview",
        description:
          "Review bookings, payments, documents, and support activity from one workspace.",
        actions: [
          { label: "Create booking", href: "/booking", tone: "primary", icon: ProjectsIcon },
          { label: "Open chat", href: "/dashboard/chat", tone: "secondary", icon: MessagesIcon },
          { label: "View bookings", href: "/dashboard/bookings", tone: "ghost", icon: BookingsIcon },
        ],
      }
    }

    if (pathname.startsWith("/dashboard/bookings") || pathname.startsWith("/dashboard/events")) {
      return {
        title: "Bookings workspace",
        description:
          "Search bookings, review milestones, and open the full event workspace.",
        actions: [
          { label: "Create booking", href: "/booking", tone: "primary", icon: ProjectsIcon },
          { label: "Contact support", href: "/dashboard/chat", tone: "secondary", icon: MessagesIcon },
        ],
      }
    }

    if (pathname.startsWith("/dashboard/chat")) {
      return {
        title: "Support conversations",
        description:
          "Keep approvals, files, and delivery conversations attached to the right booking.",
        actions: [
          { label: "View bookings", href: "/dashboard/bookings", tone: "secondary", icon: BookingsIcon },
          { label: "Notifications", href: "/dashboard/notifications", tone: "ghost", icon: NotificationsIcon },
        ],
      }
    }

    if (pathname.startsWith("/dashboard/notifications")) {
      return {
        title: "Notifications",
        description:
          "Track approvals, reminders, and project changes in one activity feed.",
        actions: [
          { label: "Open chat", href: "/dashboard/chat", tone: "secondary", icon: MessagesIcon },
          { label: "View bookings", href: "/dashboard/bookings", tone: "ghost", icon: BookingsIcon },
        ],
      }
    }

    if (pathname.startsWith("/dashboard/receipts")) {
      return {
        title: "Payment receipt",
        description:
          "Review payment confirmation and keep a clean record for finance follow-up.",
        actions: [
          { label: "Back to bookings", href: "/dashboard/bookings", tone: "secondary", icon: BookingsIcon },
          { label: "Support", href: "/dashboard/chat", tone: "ghost", icon: MessagesIcon },
        ],
      }
    }

    return {
        title: "Client portal",
        description:
          "Move between bookings, support, payments, and notifications with less friction.",
        actions: [
          { label: "Create booking", href: "/booking", tone: "primary", icon: ProjectsIcon },
          { label: "View bookings", href: "/dashboard/bookings", tone: "secondary", icon: BookingsIcon },
          { label: "Payments & docs", href: "/dashboard/bookings", tone: "ghost", icon: DocumentsIcon },
        ],
      }
  }, [pathname])

  return (
    <DashboardShell
      role="client"
      brand="The Indian Bar Company"
      product="Client Portal"
      sections={sections}
      user={{
        name: user?.name ?? "Client",
        subtitle: user?.email ?? user?.phone ?? "Verified access",
      }}
      utility={
        <StatusIndicator tone={connectionTone}>
          {getRealtimeConnectionLabel(connectionState)}
        </StatusIndicator>
      }
      headerContext={headerContext}
      onLogout={async () => {
        try {
          await logoutPortal()
        } catch (error) {
          showApiErrorToast({ pushToast }, error, "Unable to log out cleanly")
        }
        router.replace(getRoleLoginPath("CLIENT"))
      }}
    >
      {children}
    </DashboardShell>
  )
}
