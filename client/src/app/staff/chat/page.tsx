"use client"

import { Suspense } from "react"
import BookingChatScreen from "@/components/dashboard/BookingChatScreen"
import { DashboardPage, SkeletonSurface } from "@/components/dashboard/DashboardPrimitives"
import { staffApi } from "@/lib/staff-client"

export default function StaffChatPage() {
  return (
    <Suspense
      fallback={
        <DashboardPage>
          <SkeletonSurface />
        </DashboardPage>
      }
    >
      <BookingChatScreen
        role="staff"
        api={{
          listInbox: staffApi.inbox,
          getThread: staffApi.getThread,
          getThreadWindow: staffApi.getThreadWindow,
          sendMessage: staffApi.sendMessage,
          createUploadUrl: staffApi.createMessageUploadUrl,
          updateTypingStatus: staffApi.updateTypingStatus,
        }}
        hero={{
          eyebrow: "Booking conversations",
          title: "Booking messenger",
          description:
            "Reply with the right booking context, files, and participant history in view.",
        }}
        sidebar={{
          title: "Assigned bookings",
          description: "Each assigned booking appears as a live support thread.",
          emptyTitle: "No assigned conversations",
          emptyText: "Booking conversations will appear here when work is assigned to you.",
        }}
        thread={{
          emptyTitle: "Select a booking",
          emptyText: "Choose a booking from the left to open its messages.",
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
    </Suspense>
  )
}
