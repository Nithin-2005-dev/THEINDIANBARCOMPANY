"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { BookingThemeInput } from "@/components/booking-theme/booking-theme"
import { ChatWorkspace, type ChatBookingConversation, type ChatMessage } from "@/components/dashboard/ChatWorkspace"
import {
  DashboardPage,
  ErrorState,
} from "@/components/dashboard/DashboardPrimitives"
import { useAssistantPageState } from "@/lib/assistant-page-state"
import { useToast } from "@/components/dashboard/ToastProvider"
import { playMessageNotificationTone } from "@/lib/notifications-audio"
import {
  getRealtimeConnectionLabel,
  useRealtimeStream,
  type RealtimeEvent,
  type RealtimeConnectionState,
  type RealtimeRole,
} from "@/lib/realtime"
import { uploadFileToPresignedUrl } from "@/lib/uploads"
import type {
  PortalConversationType,
  PortalInboxConversation,
  PortalMessage,
  PortalThreadPage,
} from "@/types/client-portal"

type BookingChatApi = {
  listInbox: () => Promise<PortalInboxConversation[]>
  getThread: (leadId: string, conversationType?: PortalConversationType) => Promise<PortalMessage[]>
  getThreadWindow: (
    leadId: string,
    options?: {
      conversationType?: PortalConversationType
      limit?: number
      beforeCreatedAt?: string
      beforeId?: string
      search?: string
      date?: string
      hasAttachment?: boolean
    },
  ) => Promise<PortalThreadPage>
  sendMessage: (
    leadId: string,
    payload: { body: string; attachmentName?: string; attachmentKey?: string; attachmentUrl?: string },
    conversationType?: PortalConversationType,
  ) => Promise<PortalMessage>
  createUploadUrl: (
    leadId: string,
    payload: { fileName: string; contentType: string; sizeBytes: number },
    conversationType?: PortalConversationType,
  ) => Promise<{ url: string; fileUrl: string; key: string }>
  updateTypingStatus: (
    leadId: string,
    isTyping: boolean,
    conversationType?: PortalConversationType,
  ) => Promise<{ success: boolean }>
}

type BookingChatScreenProps = {
  role: RealtimeRole
  api: BookingChatApi
  hero: {
    eyebrow: string
    title: string
    description: string
  }
  sidebar: {
    title: string
    description: string
    emptyTitle: string
    emptyText: string
  }
  thread: {
    emptyTitle: string
    emptyText: string
    sendLabel?: string
    createAction?: {
      label: string
      href?: string
      onClick?: () => void
    }
  }
  search: {
    title: string
    description: string
    placeholder: string
  }
  queryKey: "bookingId" | "leadId"
  successToast: {
    title: string
    description: string
  }
  emptyErrorTitle: string
  shell?: (
    children: React.ReactNode,
    bookingTheme?: BookingThemeInput,
  ) => React.ReactNode
}

function getConnectionTone(state: RealtimeConnectionState) {
  if (state === "open") return "connected" as const
  if (state === "connecting" || state === "reconnecting") return "warning" as const
  return "offline" as const
}

function getDefaultConversationType(conversation?: ChatBookingConversation | null) {
  return conversation?.conversations[0]?.type
}

function isPortalConversationType(value: string | null): value is PortalConversationType {
  return value === "GROUP" || value === "DIRECT_ADMIN" || value === "DIRECT_STAFF" || value === "DIRECT_VENDOR"
}

function updateRouteSelection({
  pathname,
  queryKey,
  router,
  searchParams,
  bookingId,
  conversationType,
}: {
  pathname: string
  queryKey: "bookingId" | "leadId"
  router: ReturnType<typeof useRouter>
  searchParams: URLSearchParams
  bookingId?: string
  conversationType?: PortalConversationType
}) {
  const params = new URLSearchParams(searchParams.toString())

  if (bookingId) {
    params.set(queryKey, bookingId)
  } else {
    params.delete(queryKey)
  }

  if (conversationType) {
    params.set("conversationType", conversationType)
  } else {
    params.delete("conversationType")
  }

  const next = params.toString()
  router.replace(next ? `${pathname}?${next}` : pathname)
}

export default function BookingChatScreen({
  role,
  api,
  hero,
  sidebar,
  thread,
  search,
  queryKey,
  successToast,
  emptyErrorTitle,
  shell,
}: BookingChatScreenProps) {
  const { pushToast } = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryBookingId = searchParams.get(queryKey)
  const queryConversationType = searchParams.get("conversationType")

  const [bookings, setBookings] = useState<ChatBookingConversation[]>([])
  const [selectedBookingId, setSelectedBookingId] = useState("")
  const [selectedConversationType, setSelectedConversationType] = useState<PortalConversationType | undefined>(undefined)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [searchValue, setSearchValue] = useState("")
  const [messageSearch, setMessageSearch] = useState("")
  const [messageDate, setMessageDate] = useState("")
  const [attachmentsOnly, setAttachmentsOnly] = useState(false)
  const [composer, setComposer] = useState("")
  const [attachment, setAttachment] = useState<File | null>(null)
  const [typingLabel, setTypingLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoadingThreads, setIsLoadingThreads] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [nextCursor, setNextCursor] = useState<{ beforeCreatedAt: string; beforeId: string } | null>(null)
  const [messageLoadMode, setMessageLoadMode] = useState<"replace" | "prepend">("replace")
  const typingStopTimerRef = useRef<number | null>(null)
  const typingLabelTimerRef = useRef<number | null>(null)
  const typingActiveRef = useRef(false)

  const selectedBooking = useMemo(
    () => bookings.find((booking) => booking.leadId === selectedBookingId) ?? null,
    [bookings, selectedBookingId],
  )

  const activeConversationType = useMemo(() => {
    if (!selectedBooking) return undefined

    return (
      selectedBooking.conversations.find((conversation) => conversation.type === selectedConversationType)?.type ??
      getDefaultConversationType(selectedBooking)
    )
  }, [selectedBooking, selectedConversationType])

  const assistantPageState = useMemo(
    () => ({
      currentTab: "chat",
      currentView: `${role}-chat`,
      selectedBookingId: selectedBookingId || null,
      unreadChatCount: bookings.reduce((sum, booking) => sum + booking.unreadCount, 0),
      searchTerm: searchValue.trim() || messageSearch.trim() || null,
      filters: {
        conversationType: activeConversationType ?? selectedConversationType ?? null,
        messageSearch: messageSearch.trim() || null,
        messageDate: messageDate || null,
        attachmentsOnly: attachmentsOnly ? true : null,
      },
    }),
    [
      activeConversationType,
      attachmentsOnly,
      messageDate,
      messageSearch,
      role,
      searchValue,
      selectedBookingId,
      selectedConversationType,
      bookings,
    ],
  )

  useAssistantPageState(assistantPageState)

  const loadThreads = useCallback(async () => {
    try {
      const data = await api.listInbox()
      const nextBooking =
        data.find((booking) => booking.leadId === selectedBookingId) ??
        (queryBookingId ? data.find((booking) => booking.leadId === queryBookingId) : undefined) ??
        data[0]
      const queryType = isPortalConversationType(queryConversationType) ? queryConversationType : undefined
      const nextConversationType =
        nextBooking?.conversations.find((conversation) => conversation.type === selectedConversationType)?.type ??
        nextBooking?.conversations.find((conversation) => conversation.type === queryType)?.type ??
        getDefaultConversationType(nextBooking)

      setBookings(data)
      setSelectedBookingId(nextBooking?.leadId ?? "")
      setSelectedConversationType(nextConversationType)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load conversations.")
    } finally {
      setIsLoadingThreads(false)
    }
  }, [api, queryBookingId, queryConversationType, selectedBookingId, selectedConversationType])

  const loadMessages = useCallback(
    async (
      leadId: string,
      conversationType?: PortalConversationType,
      options?: {
        beforeCreatedAt?: string
        beforeId?: string
        mode?: "replace" | "prepend"
      },
    ) => {
      if (!leadId || !conversationType) return

      const mode = options?.mode ?? "replace"
      if (mode === "prepend") {
        setIsLoadingOlderMessages(true)
      } else {
        setIsLoadingMessages(true)
      }

      try {
        const page = await api.getThreadWindow(leadId, {
          conversationType,
          limit: 40,
          beforeCreatedAt: options?.beforeCreatedAt,
          beforeId: options?.beforeId,
          search: messageSearch,
          date: messageDate,
          hasAttachment: attachmentsOnly,
        })

        setMessages((current) => {
          if (mode === "prepend") {
            const existingIds = new Set(current.map((message) => message.id))
            return [...page.items.filter((message) => !existingIds.has(message.id)), ...current]
          }
          return page.items
        })
        setHasMoreMessages(page.hasMore)
        setNextCursor(page.nextCursor ?? null)
        setMessageLoadMode(mode)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load messages.")
      } finally {
        setIsLoadingMessages(false)
        setIsLoadingOlderMessages(false)
      }
    },
    [api, attachmentsOnly, messageDate, messageSearch],
  )

  const loadOlderMessages = useCallback(async () => {
    if (!selectedBookingId || !activeConversationType || !nextCursor || isLoadingOlderMessages) {
      return
    }

    await loadMessages(selectedBookingId, activeConversationType, {
      beforeCreatedAt: nextCursor.beforeCreatedAt,
      beforeId: nextCursor.beforeId,
      mode: "prepend",
    })
  }, [activeConversationType, isLoadingOlderMessages, loadMessages, nextCursor, selectedBookingId])

  useEffect(() => {
    void loadThreads()
  }, [loadThreads])

  useEffect(() => {
    if (!selectedBookingId || !activeConversationType) return
    void loadMessages(selectedBookingId, activeConversationType)
  }, [activeConversationType, attachmentsOnly, loadMessages, messageDate, messageSearch, selectedBookingId])

  const handleRealtimeEvent = useCallback(
    (event: RealtimeEvent) => {
      const payload = event.payload as {
        leadId?: string
        conversationType?: PortalConversationType
        message?: ChatMessage
        messageIds?: string[]
        readAt?: string
        actor?: { label?: string }
      }

      if (event.type.startsWith("notification.")) {
        void loadThreads()
      }

      if (event.type === "message.created") {
        void loadThreads()
        playMessageNotificationTone()

        if (
          payload.leadId !== selectedBookingId ||
          payload.conversationType !== activeConversationType ||
          !payload.message
        ) {
          return
        }

        void loadMessages(selectedBookingId, activeConversationType)
      }

      if (
        event.type === "message.read" &&
        payload.leadId === selectedBookingId &&
        payload.conversationType === activeConversationType
      ) {
        const readAt = payload.readAt
        const messageIds = payload.messageIds ?? []
        setMessages((current) =>
          current.map((message) =>
            messageIds.includes(message.id)
              ? { ...message, readAt: readAt ?? message.readAt }
              : message,
          ),
        )
        void loadThreads()
      }

      if (
        (event.type === "typing.started" || event.type === "typing.stopped") &&
        payload.leadId === selectedBookingId &&
        payload.conversationType === activeConversationType
      ) {
        if (typingLabelTimerRef.current) {
          window.clearTimeout(typingLabelTimerRef.current)
        }

        if (event.type === "typing.started") {
          setTypingLabel(`${payload.actor?.label ?? "A participant"} is typing`)
          typingLabelTimerRef.current = window.setTimeout(() => {
            setTypingLabel(null)
          }, 2000)
        } else {
          setTypingLabel(null)
        }
      }
    },
    [activeConversationType, loadMessages, loadThreads, selectedBookingId],
  )

  const { connectionState } = useRealtimeStream({
    role,
    enabled: true,
    onEvent: handleRealtimeEvent,
  })
  const previousConnectionStateRef = useRef(connectionState)

  useEffect(() => {
    const previousState = previousConnectionStateRef.current
    previousConnectionStateRef.current = connectionState

    if (
      connectionState === "open" &&
      (previousState === "reconnecting" || previousState === "connecting")
    ) {
      void loadThreads()
      if (selectedBookingId && activeConversationType) {
        void loadMessages(selectedBookingId, activeConversationType)
      }
    }
  }, [activeConversationType, connectionState, loadMessages, loadThreads, selectedBookingId])

  const filteredBookings = useMemo(() => {
    const query = searchValue.trim().toLowerCase()
    if (!query) return bookings

    const filtered = bookings.filter((booking) =>
      [
        booking.title,
        booking.location,
        booking.client.name ?? "",
        booking.client.phone ?? "",
        booking.client.email ?? "",
        ...booking.participants.admins.map((participant) => participant.name ?? ""),
        ...booking.participants.staff.map((participant) => participant.name ?? ""),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    )

    if (
      selectedBookingId &&
      filtered.every((booking) => booking.leadId !== selectedBookingId)
    ) {
      const selected = bookings.find((booking) => booking.leadId === selectedBookingId)
      if (selected) {
        return [selected, ...filtered]
      }
    }

    return filtered
  }, [bookings, searchValue, selectedBookingId])

  const selectConversation = (bookingId: string) => {
    const booking = bookings.find((item) => item.leadId === bookingId)
    const nextConversationType =
      booking?.conversations.find((conversation) => conversation.type === selectedConversationType)?.type ??
      getDefaultConversationType(booking)

    setSelectedBookingId(bookingId)
    setSelectedConversationType(nextConversationType)
    updateRouteSelection({
      pathname,
      queryKey,
      router,
      searchParams: new URLSearchParams(searchParams.toString()),
      bookingId,
      conversationType: nextConversationType,
    })
  }

  const selectConversationType = (conversationType: PortalConversationType) => {
    setSelectedConversationType(conversationType)
    updateRouteSelection({
      pathname,
      queryKey,
      router,
      searchParams: new URLSearchParams(searchParams.toString()),
      bookingId: selectedBookingId,
      conversationType,
    })
  }

  const emitTyping = useCallback(
    async (isTyping: boolean) => {
      if (!selectedBookingId || !activeConversationType || typingActiveRef.current === isTyping) return
      typingActiveRef.current = isTyping

      try {
        await api.updateTypingStatus(selectedBookingId, isTyping, activeConversationType)
      } catch {
        // Keep the composer responsive during transient realtime failures.
      }
    },
    [activeConversationType, api, selectedBookingId],
  )

  const handleComposerChange = (value: string) => {
    setComposer(value)

    if (!selectedBookingId || !activeConversationType || !selectedBooking?.canSend) return

    if (!value.trim()) {
      if (typingStopTimerRef.current) {
        window.clearTimeout(typingStopTimerRef.current)
      }
      void emitTyping(false)
      return
    }

    void emitTyping(true)
    if (typingStopTimerRef.current) {
      window.clearTimeout(typingStopTimerRef.current)
    }
    typingStopTimerRef.current = window.setTimeout(() => {
      void emitTyping(false)
    }, 1200)
  }

  useEffect(
    () => () => {
      if (typingStopTimerRef.current) {
        window.clearTimeout(typingStopTimerRef.current)
      }
      if (typingLabelTimerRef.current) {
        window.clearTimeout(typingLabelTimerRef.current)
      }
    },
    [],
  )

  const sendMessage = async () => {
    if (!selectedBookingId || !activeConversationType || !selectedBooking?.canSend || !composer.trim()) {
      return
    }

    const tempId = `temp-${Date.now()}`
    const optimisticMessage: ChatMessage = {
      id: tempId,
      body: composer,
      createdAt: new Date().toISOString(),
      sender: { id: "current-user", role: role.toUpperCase(), name: "You" },
      attachmentName: attachment?.name,
      attachmentUrl: undefined,
      type: "USER",
      conversationType: activeConversationType,
    }

    setMessages((current) => [...current, optimisticMessage])

    try {
      let attachmentPayload: {
        attachmentName?: string
        attachmentKey?: string
        attachmentUrl?: string
      } = {}

      if (attachment) {
        const upload = await api.createUploadUrl(
          selectedBookingId,
          {
            fileName: attachment.name,
            contentType: attachment.type || "application/octet-stream",
            sizeBytes: attachment.size,
          },
          activeConversationType,
        )
        await uploadFileToPresignedUrl(upload.url, attachment)
        attachmentPayload = {
          attachmentName: attachment.name,
          attachmentKey: upload.key,
          attachmentUrl: upload.fileUrl,
        }
      }

      const createdMessage = await api.sendMessage(
        selectedBookingId,
        {
          body: composer,
          ...attachmentPayload,
        },
        activeConversationType,
      )

      setMessages((current) =>
        current.map((message) => (message.id === tempId ? createdMessage : message)),
      )
      setComposer("")
      setAttachment(null)
      if (typingStopTimerRef.current) {
        window.clearTimeout(typingStopTimerRef.current)
      }
      await emitTyping(false)
      await loadThreads()
      pushToast({
        title: successToast.title,
        description: successToast.description,
        tone: "success",
      })
    } catch (err) {
      setMessages((current) => current.filter((message) => message.id !== tempId))
      pushToast({
        title: "Send failed",
        description: err instanceof Error ? err.message : "Unable to send message.",
        tone: "error",
      })
    }
  }

  if (error && !bookings.length && !isLoadingThreads) {
    return <ErrorState title={emptyErrorTitle} description={error} />
  }

  const bookingTheme = selectedBooking
    ? {
        eventType: selectedBooking.eventType,
        packageLabel: selectedBooking.packageLabel,
        packageName: selectedBooking.packageName,
      }
    : {}

  const content = (
    <DashboardPage>
      <ChatWorkspace
        workspaceTitle={hero.title}
        workspaceDescription={hero.description}
        connectionStatus={{
          label: getRealtimeConnectionLabel(connectionState),
          tone: getConnectionTone(connectionState),
        }}
        title={sidebar.title}
        description={sidebar.description}
        conversations={filteredBookings}
        selectedId={selectedBookingId}
        selectedConversationType={activeConversationType}
        onSelectConversation={selectConversation}
        onSelectConversationType={selectConversationType}
        messages={messages}
        isLoadingMessages={isLoadingMessages || isLoadingThreads}
        isLoadingOlderMessages={isLoadingOlderMessages}
        hasMoreMessages={hasMoreMessages}
        onLoadOlderMessages={loadOlderMessages}
        messageLoadMode={messageLoadMode}
        composerValue={composer}
        onComposerChange={handleComposerChange}
        onSubmit={sendMessage}
        listSearchValue={searchValue}
        onListSearchChange={setSearchValue}
        listSearchPlaceholder={search.placeholder}
        messageSearchValue={messageSearch}
        onMessageSearchChange={setMessageSearch}
        messageDateValue={messageDate}
        onMessageDateChange={setMessageDate}
        attachmentsOnly={attachmentsOnly}
        onAttachmentsOnlyChange={setAttachmentsOnly}
        fileName={attachment?.name}
        onFileChange={setAttachment}
        emptySidebarTitle={sidebar.emptyTitle}
        emptySidebarText={sidebar.emptyText}
        emptyThreadTitle={thread.emptyTitle}
        emptyThreadText={thread.emptyText}
        createAction={thread.createAction}
        sendLabel={thread.sendLabel}
        activityText={typingLabel}
      />
    </DashboardPage>
  )

  return shell ? shell(content, bookingTheme) : content
}
