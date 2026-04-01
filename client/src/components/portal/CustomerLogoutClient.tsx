"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getRoleLoginPath } from "@/lib/auth-routes"
import { logoutPortal } from "@/lib/client-portal"

export default function CustomerLogoutClient() {
  const router = useRouter()

  useEffect(() => {
    logoutPortal()
      .catch(() => undefined)
      .finally(() => {
        router.replace(getRoleLoginPath("CLIENT"))
      })
  }, [router])

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.16),_transparent_28%),linear-gradient(180deg,#090807_0%,#050505_100%)] px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center justify-center">
        <div className="rounded-[32px] border border-white/10 bg-white/[0.05] p-8 text-center backdrop-blur-xl">
          <p className="text-[10px] uppercase tracking-[0.34em] text-[#d4af37]">Signing Out</p>
          <h1 className="mt-4 font-serif text-4xl text-white/95">Closing your secure session</h1>
        </div>
      </div>
    </main>
  )
}
