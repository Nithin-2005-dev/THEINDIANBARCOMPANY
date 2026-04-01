"use client"

import { usePathname } from "next/navigation"
import Footer from "@/components/layout/Footer/Footer"
import Navbar from "@/components/layout/Navbar/Navbar"
import { themeStyles } from "@/lib/theme"

type AppShellProps = {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const isAdminRoute = pathname.startsWith("/admin")
  const isStaffRoute = pathname.startsWith("/staff")
  const isVendorRoute = pathname.startsWith("/vendor")
  const isPortalRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/booking") ||
    pathname === "/login" ||
    pathname === "/verify-otp" ||
    pathname === "/logout"

  if (isAdminRoute || isStaffRoute || isVendorRoute || isPortalRoute) {
    return <>{children}</>
  }

  return (
    <div style={themeStyles.tib}>
      <Navbar />
      {children}
      <Footer />
    </div>
  )
}
