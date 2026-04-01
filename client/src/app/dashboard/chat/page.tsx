"use client"

import { Suspense } from "react"
import BookingChatScreen from "@/components/dashboard/BookingChatScreen"
import { DashboardPage, SkeletonSurface } from "@/components/dashboard/DashboardPrimitives"
import PortalShell from "@/components/portal/PortalShell"
import {
  createEventMessageUploadUrl,
  fetchPortalInbox,
  fetchPortalThread,
  fetchPortalThreadWindow,
  sendEventMessage,
  updateEventTypingStatus,
} from "@/lib/client-portal"

export default function ClientChatPage() {
  return (
    <Suspense
      fallback={
        <PortalShell bookingTheme={{}}>
          <DashboardPage>
            <SkeletonSurface />
          </DashboardPage>
        </PortalShell>
      }
    >
      <BookingChatScreen
        role="client"
        api={{
          listInbox: fetchPortalInbox,
          getThread: fetchPortalThread,
          getThreadWindow: fetchPortalThreadWindow,
          sendMessage: sendEventMessage,
          createUploadUrl: createEventMessageUploadUrl,
          updateTypingStatus: updateEventTypingStatus,
        }}
        hero={{
          eyebrow: "Booking conversations",
          title: "Support conversations",
          description:
            "Message our team about each event with the booking details, files, and latest updates in one place.",
        }}
        sidebar={{
          title: "Your bookings",
          description: "Each booking appears here as its own support thread.",
          emptyTitle: "No conversations yet",
          emptyText: "You'll be able to chat with our team once a booking is created.",
        }}
        thread={{
          emptyTitle: "Select a booking",
          emptyText: "You'll be able to chat with our team once a booking is created.",
          createAction: {
            label: "Create booking",
            href: "/booking",
          },
          sendLabel: "Send",
        }}
        search={{
          title: "Search bookings",
          description: "",
          placeholder: "Search bookings",
        }}
        queryKey="bookingId"
        successToast={{
          title: "Message sent",
          description: "Your booking conversation has been updated.",
        }}
        emptyErrorTitle="Chat unavailable"
        shell={(children, bookingTheme) => (
          <PortalShell bookingTheme={bookingTheme ?? {}}>
            {children}
          </PortalShell>
        )}
      />
    </Suspense>
  )
}
