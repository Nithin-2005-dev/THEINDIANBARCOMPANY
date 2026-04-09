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
  AnalyticsIcon,
  BookingsIcon,
  DocumentsIcon,
  EmailIcon,
  MessagesIcon,
  NotificationsIcon,
  PaymentsIcon,
  PipelineIcon,
  ProfilesIcon,
  ProjectsIcon,
  SettingsIcon,
  TeamIcon,
  VendorsIcon,
} from "@/components/dashboard/icons"
import { useToast } from "@/components/dashboard/ToastProvider"
import { apiRequest, showApiErrorToast } from "@/lib/api"
import { adminApi } from "@/lib/admin-client"
import { getRoleLoginPath } from "@/lib/auth-routes"
import { getRealtimeConnectionLabel, useRealtimeStream } from "@/lib/realtime"
import { canManageFinance, canManageUsers } from "@/lib/roles"
import type { AdminUser } from "@/types/admin"

type AdminShellProps = {
  children: React.ReactNode
}

export default function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { pushToast } = useToast()
  const [user, setUser] = useState<AdminUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notificationCount, setNotificationCount] = useState(0)
  const [chatUnreadCount, setChatUnreadCount] = useState(0)

  useEffect(() => {
    adminApi
      .me()
      .then(setUser)
      .catch(() => {
        router.replace(getRoleLoginPath("ADMIN", pathname))
      })
      .finally(() => setIsLoading(false))
  }, [pathname, router])

  const refreshBadges = useCallback(async () => {
    if (!user) return

    try {
      const [notifications, inbox] = await Promise.all([
        adminApi.listNotifications(),
        adminApi.listInbox(),
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
    role: "admin",
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
    const core = [
      { href: "/admin", label: "Overview", icon: AnalyticsIcon },
      {
        href: "/admin/bookings",
        label: "Bookings",
        icon: BookingsIcon,
        matchPrefixes: ["/admin/bookings", "/admin/leads"],
      },
      { href: "/admin/pipeline", label: "Pipeline", icon: PipelineIcon },
      { href: "/admin/projects", label: "Projects", icon: ProjectsIcon },
      {
        href: "/admin/chat",
        label: "Chat",
        icon: MessagesIcon,
        badge: chatUnreadCount || undefined,
      },
      {
        href: "/admin/notifications",
        label: "Notifications",
        icon: NotificationsIcon,
        badge: notificationCount || undefined,
      },
      {
        href: "/admin/email-tracking",
        label: "Email Tracking",
        icon: EmailIcon,
      },
      {
        href: "/admin/assistant",
        label: "Assistant",
        icon: AnalyticsIcon,
        matchPrefixes: ["/admin/assistant"],
      },
    ]

    const operations = [
      { href: "/admin/proposals", label: "Proposals", icon: DocumentsIcon },
      { href: "/admin/contracts", label: "Contracts", icon: DocumentsIcon },
      { href: "/admin/vendors", label: "Vendors", icon: VendorsIcon },
    ]
    const administration = [
      { href: "/admin/settings", label: "Settings", icon: SettingsIcon },
    ]

    if (canManageFinance(user?.role)) {
      administration.unshift({
        href: "/admin/payments",
        label: "Payments",
        icon: PaymentsIcon,
      })
    }

    if (canManageUsers(user?.role)) {
      administration.unshift(
        {
          href: "/admin/team",
          label: "Team",
          icon: ProfilesIcon,
        },
        {
          href: "/admin/users",
          label: "Users",
          icon: TeamIcon,
        },
      )
    }

    return [
      { label: "Command Center", items: core },
      { label: "Operations", items: operations },
      { label: "Administration", items: administration },
    ]
  }, [chatUnreadCount, notificationCount, user?.role])

  const headerContext = useMemo<DashboardHeaderContext>(() => {
    if (pathname === "/admin") {
      return {
        title: "Command center",
        description:
          "Monitor revenue, bookings, execution risk, and team activity from one workspace.",
        actions: [
          { label: "Open bookings", href: "/admin/bookings", tone: "primary", icon: BookingsIcon },
          { label: "Pipeline", href: "/admin/pipeline", tone: "secondary", icon: PipelineIcon },
          { label: "Projects", href: "/admin/projects", tone: "ghost", icon: ProjectsIcon },
        ],
      }
    }

    if (pathname.startsWith("/admin/bookings") || pathname.startsWith("/admin/leads")) {
      return {
        title: "Bookings operations",
        description:
          "Qualify incoming demand and keep payment, contract, and execution work on track.",
        actions: [
          { label: "Create booking", href: "/admin/bookings/new", tone: "primary", icon: BookingsIcon },
          { label: "Open pipeline", href: "/admin/pipeline", tone: "secondary", icon: PipelineIcon },
          { label: "Projects", href: "/admin/projects", tone: "ghost", icon: ProjectsIcon },
        ],
      }
    }

    if (pathname.startsWith("/admin/pipeline")) {
      return {
        title: "Pipeline",
        actions: [],
      }
    }

    if (pathname.startsWith("/admin/team")) {
      return {
        title: "Team roster",
        description:
          "Manage the public-facing bartender, trustee, and influencer profiles with controlled visibility and polished imagery.",
        actions: [
          { label: "Users", href: "/admin/users", tone: "secondary", icon: TeamIcon },
          { label: "Settings", href: "/admin/settings", tone: "ghost", icon: SettingsIcon },
        ],
      }
    }

    if (pathname.startsWith("/admin/contracts")) {
      return {
        title: "Contract operations",
        description:
          "Issue, revise, and track agreements from approval through signed execution.",
        actions: [
          { label: "Bookings", href: "/admin/bookings", tone: "secondary", icon: BookingsIcon },
          { label: "Payments", href: "/admin/payments", tone: "ghost", icon: PaymentsIcon },
        ],
      }
    }

    if (pathname.startsWith("/admin/assistant")) {
      return {
        title: "Assistant analytics",
        description:
          "Track Beer usage, fallback patterns, page opens, and the shortcuts that are actually working.",
        actions: [
          { label: "Bookings", href: "/admin/bookings", tone: "secondary", icon: BookingsIcon },
          { label: "Chat", href: "/admin/chat", tone: "ghost", icon: MessagesIcon },
        ],
      }
    }

    if (pathname.startsWith("/admin/email-tracking")) {
      return {
        title: "Email tracking",
        description:
          "Monitor queued, retrying, sent, and failed emails with resend controls and delivery history.",
        actions: [
          { label: "Settings", href: "/admin/settings", tone: "secondary", icon: NotificationsIcon },
          { label: "Bookings", href: "/admin/bookings", tone: "ghost", icon: BookingsIcon },
        ],
      }
    }

    if (pathname.startsWith("/admin/payments")) {
      return {
        title: "Payments and milestones",
        description:
          "Track collections, failed payments, refunds, and milestone timing in one place.",
        actions: [
          { label: "Bookings", href: "/admin/bookings", tone: "secondary", icon: BookingsIcon },
          { label: "Projects", href: "/admin/projects", tone: "ghost", icon: ProjectsIcon },
        ],
      }
    }

    return {
      title: "Admin workspace",
      description:
        "Navigate high-volume operational work with clearer structure and faster access.",
      actions: [
        { label: "Bookings", href: "/admin/bookings", tone: "primary", icon: BookingsIcon },
        { label: "Projects", href: "/admin/projects", tone: "secondary", icon: ProjectsIcon },
        { label: "Chat", href: "/admin/chat", tone: "ghost", icon: MessagesIcon },
      ],
    }
  }, [pathname])

  if (isLoading) {
    return <DashboardScreenLoader metricCount={4} />
  }

  return (
    <DashboardShell
      role="admin"
      brand="The Indian Bar Company"
      product="Admin Command"
      sections={sections}
      user={{
        name: user?.name ?? "Admin User",
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
            url: "/admin/auth/logout",
            method: "POST",
          })
        } catch (error) {
          showApiErrorToast({ pushToast }, error, "Unable to log out cleanly")
        }
        router.replace(getRoleLoginPath("ADMIN"))
      }}
    >
      {children}
    </DashboardShell>
  )
}
