"use client"

import { Suspense } from "react"
import BookingChatScreen from "@/components/dashboard/BookingChatScreen"
import { DashboardPage, SkeletonSurface } from "@/components/dashboard/DashboardPrimitives"
import { adminApi } from "@/lib/admin-client"

export default function AdminChatPage() {
  return (
    <Suspense
      fallback={
        <DashboardPage>
          <SkeletonSurface />
        </DashboardPage>
      }
    >
      <AdminChatPageContent />
    </Suspense>
  )
}

function AdminChatPageContent() {
  return (
    <BookingChatScreen
      role="admin"
      api={{
        listInbox: adminApi.listInbox,
        getThread: adminApi.getLeadThread,
        getThreadWindow: adminApi.getLeadThreadWindow,
        sendMessage: adminApi.sendLeadMessage,
        createUploadUrl: adminApi.createLeadMessageUploadUrl,
        updateTypingStatus: adminApi.updateLeadTypingStatus,
      }}
      hero={{
        eyebrow: "Booking conversations",
        title: "Booking messenger",
        description:
          "Handle client and team communication in a focused booking-by-booking workspace.",
      }}
      sidebar={{
        title: "Bookings",
        description: "Each booking appears as a live support thread.",
        emptyTitle: "No booking conversations",
        emptyText: "Assigned booking conversations will appear here.",
      }}
      thread={{
        emptyTitle: "Select a booking",
        emptyText: "Choose a booking to open its messages.",
        sendLabel: "Send",
      }}
      search={{
        title: "Search bookings",
        description: "",
        placeholder: "Search bookings",
      }}
      queryKey="leadId"
      successToast={{
        title: "Message sent",
        description: "The booking conversation has been updated.",
      }}
      emptyErrorTitle="Chat unavailable"
    />
  )
}
