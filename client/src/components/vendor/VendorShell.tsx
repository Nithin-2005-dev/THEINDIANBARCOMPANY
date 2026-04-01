"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  DashboardShell,
  type DashboardHeaderContext,
  type DashboardNavSection,
} from "@/components/dashboard/DashboardShell"
import { DashboardScreenLoader } from "@/components/dashboard/DashboardPrimitives"
import {
  DocumentsIcon,
  ProjectsIcon,
} from "@/components/dashboard/icons"
import { useToast } from "@/components/dashboard/ToastProvider"
import { apiRequest, showApiErrorToast } from "@/lib/api"
import { getRoleLoginPath } from "@/lib/auth-routes"
import { vendorApi } from "@/lib/vendor-client"
import type { AdminUser } from "@/types/admin"

export default function VendorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { pushToast } = useToast()
  const [user, setUser] = useState<AdminUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    vendorApi
      .me()
      .then((nextUser) => setUser(nextUser as AdminUser))
      .catch(() => {
        router.replace(getRoleLoginPath("VENDOR", pathname))
      })
      .finally(() => setIsLoading(false))
  }, [pathname, router])

  const sections = useMemo<DashboardNavSection[]>(
    () => [
      {
        label: "Vendor Workspace",
        items: [
          {
            href: "/vendor",
            label: "Assignments",
            icon: ProjectsIcon,
            matchPrefixes: ["/vendor", "/vendor/projects"],
          },
        ],
      },
    ],
    [],
  )

  const headerContext = useMemo<DashboardHeaderContext>(() => {
    if (pathname.startsWith("/vendor/projects/")) {
      return {
        title: "Assignment workspace",
        description:
          "Review scope, execution notes, files, and delivery updates from one streamlined project view.",
        actions: [
          { label: "All assignments", href: "/vendor", tone: "primary", icon: ProjectsIcon },
        ],
      }
    }

    return {
      title: "Vendor assignments",
      description:
        "Stay focused on confirmed work, delivery context, and the next execution step without extra clutter.",
      actions: [
        { label: "Assignments", href: "/vendor", tone: "primary", icon: ProjectsIcon },
        { label: "Project details", href: "/vendor", tone: "ghost", icon: DocumentsIcon },
      ],
    }
  }, [pathname])

  if (isLoading) {
    return <DashboardScreenLoader metricCount={4} />
  }

  return (
    <DashboardShell
      role="vendor"
      brand="The Indian Bar Company"
      product="Vendor Workspace"
      sections={sections}
      user={{
        name: user?.name ?? "Vendor",
        subtitle: user?.email ?? user?.phone ?? "Partner access",
      }}
      headerContext={headerContext}
      onLogout={async () => {
        try {
          await apiRequest({
            url: "/vendor/auth/logout",
            method: "POST",
          })
        } catch (error) {
          showApiErrorToast({ pushToast }, error, "Unable to log out cleanly")
        }
        router.replace(getRoleLoginPath("VENDOR"))
      }}
    >
      {children}
    </DashboardShell>
  )
}
