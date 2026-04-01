"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { preloadBeerAvatarSprite } from "@/components/assistant/BeerAssistantAvatar"
import BeerAssistantBear from "@/components/assistant/BeerAssistantBear"
import BeerAssistantSidebar from "@/components/assistant/BeerAssistantSidebar"
import BeerAssistantWindow from "@/components/assistant/BeerAssistantWindow"
import styles from "@/components/assistant/BeerAssistant.module.css"
import { resolveBookingService } from "@/components/booking/booking-service-config"
import { resolveAssistantContext } from "@/lib/assistant-context"
import { assistantClient } from "@/lib/assistant-client"
import {
  ASSISTANT_PAGE_STATE_EVENT,
  readAssistantPageState,
} from "@/lib/assistant-page-state"
import { fetchSharedAuthSession } from "@/lib/login-auth"
import { isStaffRole } from "@/lib/roles"
import type {
  AssistantAction,
  AssistantConversation,
  AssistantConversationContext,
  AssistantMessage,
  AssistantPromptSuggestion,
  AssistantWorkspaceRole,
} from "@/types/assistant"

function inferRoleFromPath(pathname: string): AssistantWorkspaceRole | null {
  if (
    pathname.endsWith("/login") ||
    pathname.endsWith("/verify-otp") ||
    pathname.endsWith("/logout")
  ) {
    return null
  }

  if (pathname.startsWith("/admin")) return "admin"
  if (pathname.startsWith("/staff")) return "staff"
  if (pathname.startsWith("/vendor")) return "vendor"
  if (pathname.startsWith("/dashboard")) return "client"
  return null
}

function resolveSessionRole(role?: string | null): AssistantWorkspaceRole | null {
  if (!role) return null
  if (role === "ADMIN") return "admin"
  if (role === "CLIENT") return "client"
  if (role === "VENDOR") return "vendor"
  if (isStaffRole(role)) return "staff"
  return null
}

function getModeLabel(role: AssistantWorkspaceRole) {
  switch (role) {
    case "admin":
      return "Admin mode"
    case "staff":
      return "Staff mode"
    case "vendor":
      return "Vendor mode"
    case "client":
      return "Client mode"
    default:
      return "Public mode"
  }
}

function getFallbackPageLabel(pathname: string, pageTitle?: string) {
  if (pageTitle?.trim()) return pageTitle.trim()
  if (pathname === "/") return "Homepage"
  if (pathname.startsWith("/booking")) return "Booking flow"
  if (pathname.startsWith("/dashboard")) return "Client dashboard"
  if (pathname.startsWith("/admin")) return "Admin workspace"
  if (pathname.startsWith("/staff")) return "Staff workspace"
  if (pathname.startsWith("/vendor")) return "Vendor workspace"

  const firstSegment = pathname.split("/").filter(Boolean)[0]
  if (!firstSegment) return "Current page"

  return firstSegment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function buildAssistantContextHints(context: AssistantConversationContext) {
  const metadata = context.metadata ?? {}
  const hints: string[] = []

  const currentTab =
    typeof metadata.currentTab === "string"
      ? humanizeAssistantContextValue(metadata.currentTab)
      : null
  const currentView =
    typeof metadata.currentView === "string"
      ? humanizeAssistantContextValue(metadata.currentView)
      : null
  const searchTerm =
    typeof metadata.searchTerm === "string" ? metadata.searchTerm.trim() : ""
  const unreadNotificationCount =
    typeof metadata.unreadNotificationCount === "number"
      ? metadata.unreadNotificationCount
      : 0
  const unreadChatCount =
    typeof metadata.unreadChatCount === "number" ? metadata.unreadChatCount : 0
  const overduePaymentCount =
    typeof metadata.overduePaymentCount === "number"
      ? metadata.overduePaymentCount
      : 0
  const pendingPaymentCount =
    typeof metadata.pendingPaymentCount === "number"
      ? metadata.pendingPaymentCount
      : 0
  const unsignedContractCount =
    typeof metadata.unsignedContractCount === "number"
      ? metadata.unsignedContractCount
      : 0
  const pendingTaskCount =
    typeof metadata.pendingTaskCount === "number" ? metadata.pendingTaskCount : 0
  const blockedBookingCount =
    typeof metadata.blockedBookingCount === "number"
      ? metadata.blockedBookingCount
      : 0
  const recentActionLabels =
    Array.isArray(metadata.recentActionLabels) &&
    metadata.recentActionLabels.every((label) => typeof label === "string")
      ? (metadata.recentActionLabels as string[])
      : []
  const filters =
    metadata.filters &&
    typeof metadata.filters === "object" &&
    !Array.isArray(metadata.filters)
      ? (metadata.filters as Record<string, unknown>)
      : null

  if (currentTab) {
    hints.push(`Tab: ${currentTab}`)
  }

  if (currentView && currentView !== currentTab) {
    hints.push(`View: ${currentView}`)
  }

  if (searchTerm) {
    hints.push(`Search: ${truncateAssistantHint(searchTerm, 28)}`)
  }

  if (unreadNotificationCount) {
    hints.push(
      `${unreadNotificationCount} unread notification${unreadNotificationCount === 1 ? "" : "s"}`,
    )
  }

  if (unreadChatCount) {
    hints.push(`${unreadChatCount} unread chat${unreadChatCount === 1 ? "" : "s"}`)
  }

  if (overduePaymentCount) {
    hints.push(
      `${overduePaymentCount} overdue payment${overduePaymentCount === 1 ? "" : "s"}`,
    )
  }

  if (pendingPaymentCount) {
    hints.push(
      `${pendingPaymentCount} pending payment${pendingPaymentCount === 1 ? "" : "s"}`,
    )
  }

  if (unsignedContractCount) {
    hints.push(
      `${unsignedContractCount} unsigned contract${unsignedContractCount === 1 ? "" : "s"}`,
    )
  }

  if (pendingTaskCount) {
    hints.push(`${pendingTaskCount} pending task${pendingTaskCount === 1 ? "" : "s"}`)
  }

  if (blockedBookingCount) {
    hints.push(
      `${blockedBookingCount} blocked booking${blockedBookingCount === 1 ? "" : "s"}`,
    )
  }

  if (recentActionLabels.length) {
    hints.push(
      `Recent: ${truncateAssistantHint(recentActionLabels.slice(0, 2).join(", "), 32)}`,
    )
  }

  if (filters) {
    const ignoredFilterKeys = new Set(["page", "sortBy", "sortOrder", "conversationType"])
    const meaningfulFilterCount = Object.entries(filters).filter(([key, value]) => {
      if (ignoredFilterKeys.has(key)) {
        return false
      }

      if (value === null || value === undefined || value === "") {
        return false
      }

      if (Array.isArray(value)) {
        return value.length > 0
      }

      if (typeof value === "object") {
        return Object.keys(value as Record<string, unknown>).length > 0
      }

      return true
    }).length

    if (meaningfulFilterCount) {
      hints.push(
        `${meaningfulFilterCount} filter${meaningfulFilterCount === 1 ? "" : "s"} active`,
      )
    }
  }

  if (typeof metadata.selectedBookingId === "string") {
    hints.push("Booking focused")
  }
  if (typeof metadata.selectedContractId === "string") {
    hints.push("Contract focused")
  }
  if (typeof metadata.selectedProjectId === "string") {
    hints.push("Project focused")
  }
  if (typeof metadata.selectedPaymentId === "string") {
    hints.push("Payment focused")
  }
  if (typeof metadata.selectedConversationId === "string") {
    hints.push("Conversation focused")
  }

  return hints.slice(0, 6)
}

function humanizeAssistantContextValue(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function truncateAssistantHint(value: string, maxLength: number) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 3)}...`
}

export default function BeerAssistant() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const inferredRole = useMemo(() => inferRoleFromPath(pathname), [pathname])
  const [role, setRole] = useState<AssistantWorkspaceRole>(inferredRole ?? "public")
  const [isOpen, setIsOpen] = useState(false)
  const [pageTitle, setPageTitle] = useState("")
  const [conversations, setConversations] = useState<AssistantConversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [suggestions, setSuggestions] = useState<AssistantPromptSuggestion[]>([])
  const [composerValue, setComposerValue] = useState("")
  const [streamingMessage, setStreamingMessage] = useState("")
  const [searchValue, setSearchValue] = useState("")
  const [showArchived, setShowArchived] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isLoadingConversations, setIsLoadingConversations] = useState(false)
  const [bearAvatarSrc, setBearAvatarSrc] = useState<string | null>(null)
  const [hasDismissedWelcome, setHasDismissedWelcome] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [pageState, setPageState] = useState<Record<string, unknown> | null>(null)
  const lastConversationSearchRef = useRef("")
  const openSessionLoggedRef = useRef(false)

  useEffect(() => {
    setPageTitle(typeof document !== "undefined" ? document.title : "")
  }, [pathname, isOpen])

  useEffect(() => {
    if (inferredRole) {
      setRole(inferredRole)
      return
    }

    let cancelled = false
    setRole("public")

    void fetchSharedAuthSession()
      .then((session) => {
        if (cancelled) return
        const payload = session.user as
          | { role?: string | null; user?: { role?: string | null } | null }
          | undefined
        const nextRole = resolveSessionRole(payload?.role ?? payload?.user?.role ?? null)
        if (nextRole) {
          setRole(nextRole)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRole("public")
        }
      })

    return () => {
      cancelled = true
    }
  }, [inferredRole, pathname])

  useEffect(() => {
    setConversations([])
    setSelectedConversationId(null)
    setMessages([])
    setSuggestions([])
    setSearchValue("")
    setShowArchived(false)
    setComposerValue("")
    setStreamingMessage("")
    setMobileSidebarOpen(false)
  }, [role])

  useEffect(() => {
    setPageState(readAssistantPageState())

    const handlePageState = (event: Event) => {
      const nextState = (event as CustomEvent<Record<string, unknown> | null>).detail ?? null
      setPageState(nextState)
    }

    window.addEventListener(ASSISTANT_PAGE_STATE_EVENT, handlePageState as EventListener)
    return () => {
      window.removeEventListener(ASSISTANT_PAGE_STATE_EVENT, handlePageState as EventListener)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen])

  useEffect(() => {
    if (bearAvatarSrc || !isOpen) return

    let cancelled = false

    void preloadBeerAvatarSprite()
      .then((src) => {
        if (!cancelled) {
          setBearAvatarSrc(src)
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [bearAvatarSrc, isOpen])

  const handleBearReady = useCallback(() => {
    if (!hasDismissedWelcome) {
      setShowWelcome(true)
    }
  }, [hasDismissedWelcome])

  const context = useMemo(() => {
    const baseContext = resolveAssistantContext(role, pathname, pageTitle, searchParams, pageState)
    const queryService = resolveBookingService(searchParams.get("service"))?.slug

    if (!queryService) {
      return baseContext
    }

    return {
      ...baseContext,
      metadata: {
        ...baseContext.metadata,
        serviceSlug: queryService,
        serviceLabel: resolveBookingService(queryService)?.shortLabel,
      },
    }
  }, [pageState, pageTitle, pathname, role, searchParams])

  const modeLabel = useMemo(() => getModeLabel(role), [role])
  const isGuestMode = role === "public"
  const pageLabel = useMemo(
    () => context.pageTitle ?? getFallbackPageLabel(pathname, pageTitle),
    [context.pageTitle, pageTitle, pathname],
  )
  const contextHints = useMemo(() => buildAssistantContextHints(context), [context])
  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  )

  const trackAssistantEvent = useCallback(
    (
      eventType: string,
      options?: {
        conversationId?: string | null
        label?: string
        contentSnippet?: string
        intent?: string
        metadata?: Record<string, unknown>
      },
    ) => {
      const pageKey =
        typeof context.metadata?.currentView === "string"
          ? context.metadata.currentView
          : typeof context.metadata?.section === "string"
            ? context.metadata.section
            : undefined

      void assistantClient
        .trackEvent(role, {
          eventType,
          conversationId: options?.conversationId ?? selectedConversationId ?? undefined,
          pageKey,
          section:
            typeof context.metadata?.section === "string"
              ? context.metadata.section
              : undefined,
          label: options?.label,
          contentSnippet: options?.contentSnippet,
          intent: options?.intent,
          metadata: options?.metadata,
        })
        .catch(() => {})
    },
    [context.metadata, role, selectedConversationId],
  )

  const loadSuggestions = useCallback(async () => {
    const nextSuggestions = await assistantClient.getSuggestions(role, context)
    setSuggestions(nextSuggestions)
  }, [context, role])

  const loadConversations = useCallback(async () => {
    setIsLoadingConversations(true)

    try {
      const nextConversations = await assistantClient.listConversations(
        role,
        {
          search: searchValue.trim() || undefined,
          archived: showArchived,
        },
      )
      setConversations(nextConversations)
      const trimmedSearch = searchValue.trim()
      if (
        trimmedSearch &&
        trimmedSearch !== lastConversationSearchRef.current
      ) {
        lastConversationSearchRef.current = trimmedSearch
        trackAssistantEvent("conversation_search", {
          label: trimmedSearch.slice(0, 120),
          contentSnippet: trimmedSearch.slice(0, 240),
          metadata: {
            archived: showArchived,
            resultCount: nextConversations.length,
          },
        })
      }
      setSelectedConversationId((current) => {
        const nextSelected = resolveNextConversationId(
          nextConversations,
          current,
          readSelectedConversationId(role),
          context,
        )

        persistSelectedConversationId(role, nextSelected)
        return nextSelected
      })
    } catch {
      setConversations([])
      setSelectedConversationId(null)
      persistSelectedConversationId(role, null)
    } finally {
      setIsLoadingConversations(false)
    }
  }, [context, role, searchValue, showArchived, trackAssistantEvent])

  useEffect(() => {
    if (!isOpen) return

    void Promise.allSettled([loadSuggestions(), loadConversations()]).then((results) => {
      if (results[0]?.status === "rejected") {
        setSuggestions([])
      }
    })
  }, [isOpen, loadConversations, loadSuggestions])

  useEffect(() => {
    if (!isOpen) {
      openSessionLoggedRef.current = false
      return
    }

    if (openSessionLoggedRef.current) {
      return
    }

    openSessionLoggedRef.current = true
    trackAssistantEvent("assistant_opened", {
      label: pageLabel,
      contentSnippet: pageTitle || pageLabel,
      metadata: {
        pagePath: context.pagePath,
        pageTitle: context.pageTitle,
        section:
          typeof context.metadata?.section === "string"
            ? context.metadata.section
            : undefined,
        currentTab:
          typeof context.metadata?.currentTab === "string"
            ? context.metadata.currentTab
            : undefined,
        currentView:
          typeof context.metadata?.currentView === "string"
            ? context.metadata.currentView
            : undefined,
        selectedBookingId:
          typeof context.metadata?.selectedBookingId === "string"
            ? context.metadata.selectedBookingId
            : undefined,
        selectedProjectId:
          typeof context.metadata?.selectedProjectId === "string"
            ? context.metadata.selectedProjectId
            : undefined,
        selectedPaymentId:
          typeof context.metadata?.selectedPaymentId === "string"
            ? context.metadata.selectedPaymentId
            : undefined,
      },
    })
  }, [context, isOpen, pageLabel, pageTitle, trackAssistantEvent])

  useEffect(() => {
    if (!isOpen) return

    if (!selectedConversationId) {
      setMessages([])
      return
    }

    let cancelled = false
    void assistantClient
      .getMessages(role, selectedConversationId)
      .then((nextMessages) => {
        if (!cancelled) {
          setMessages(nextMessages)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMessages([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, role, selectedConversationId])

  const createConversation = useCallback(async () => {
    setShowArchived(false)
    const conversation = await assistantClient.createConversation(role, {
      context,
    })
    persistSelectedConversationId(role, conversation.id)
    setConversations((current) => upsertConversation(current, conversation))
    setSelectedConversationId(conversation.id)
    setMessages([])
    setMobileSidebarOpen(false)
    trackAssistantEvent("conversation_created", {
      conversationId: conversation.id,
      label: conversation.title,
      metadata: {
        pagePath: conversation.pagePath,
        pageTitle: conversation.pageTitle,
      },
    })
    return conversation
  }, [context, role, trackAssistantEvent])

  const handleSend = useCallback(
    async (content: string, source: "composer" | "suggestion" = "composer") => {
      const trimmed = content.trim()
      if (!trimmed || isSending) return

      setComposerValue("")
      setIsSending(true)
      setStreamingMessage("")

      const requestContext = withConversationHistory(context, messages)
      let conversationId = selectedConversationId

      try {
        if (!conversationId) {
          const created = await createConversation()
          conversationId = created.id
        }

        if (source === "suggestion") {
          trackAssistantEvent("prompt_selected", {
            conversationId,
            label: trimmed.slice(0, 120),
            contentSnippet: trimmed.slice(0, 240),
          })
        }

        await assistantClient.streamMessage(
          role,
          conversationId,
          {
            content: trimmed,
            context: requestContext,
          },
          {
            onTurn: (payload) => {
              persistSelectedConversationId(role, payload.conversation.id)
              setSelectedConversationId(payload.conversation.id)
              setConversations((current) => upsertConversation(current, payload.conversation))
              setMessages((current) => mergeMessages(current, [payload.userMessage]))
            },
            onChunk: (delta) => {
              setStreamingMessage((current) => current + delta)
            },
            onComplete: (payload) => {
              setStreamingMessage("")
              setConversations((current) => upsertConversation(current, payload.conversation))
              setMessages((current) =>
                mergeMessages(current, [payload.userMessage, payload.assistantMessage]),
              )
            },
          },
        )
      } catch {
        if (!conversationId) {
          setIsSending(false)
          setStreamingMessage("")
          return
        }

        try {
          const payload = await assistantClient.sendMessage(role, conversationId, {
            content: trimmed,
            context: requestContext,
          })

          persistSelectedConversationId(role, payload.conversation.id)
          setSelectedConversationId(payload.conversation.id)
          setConversations((current) => upsertConversation(current, payload.conversation))
          setMessages((current) =>
            mergeMessages(current, [payload.userMessage, payload.assistantMessage]),
          )
        } catch {
          setMessages((current) =>
            mergeMessages(current, [
              {
                id: `assistant-error-${Date.now()}`,
                actor: "ASSISTANT",
                content:
                  "I lost the line for a moment. Try that once more and I'll pick it up again.",
                actions: [
                  {
                    id: "assistant-refresh",
                    type: "REFRESH",
                    label: "Refresh prompts",
                  },
                ],
                createdAt: new Date().toISOString(),
              },
            ]),
          )
        }
      } finally {
        setIsSending(false)
        setStreamingMessage("")
      }
    },
    [
      context,
      createConversation,
      isSending,
      messages,
      role,
      selectedConversationId,
      trackAssistantEvent,
    ],
  )

  const handleAction = useCallback(
    async (action: AssistantAction) => {
      trackAssistantEvent("action_clicked", {
        conversationId: selectedConversationId,
        label: action.label,
        metadata: {
          actionType: action.type,
          href: action.href,
        },
      })

      if (action.type === "NAVIGATE" && action.href) {
        setIsOpen(false)
        router.push(action.href)
        return
      }

      if (action.type === "COPY_TEXT") {
        const text = typeof action.payload?.text === "string" ? action.payload.text : ""
        if (text && navigator?.clipboard) {
          await navigator.clipboard.writeText(text)
        }
        return
      }

      if (action.type === "APPLY_DRAFT") {
        const text = typeof action.payload?.text === "string" ? action.payload.text : ""
        if (text) setComposerValue(text)
        return
      }

      if (action.type === "REFRESH") {
        await Promise.allSettled([loadSuggestions(), loadConversations()])
      }
    },
    [
      loadConversations,
      loadSuggestions,
      router,
      selectedConversationId,
      trackAssistantEvent,
    ],
  )

  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      persistSelectedConversationId(role, conversationId)
      setSelectedConversationId(conversationId)
      setMobileSidebarOpen(false)
      trackAssistantEvent("conversation_selected", {
        conversationId,
      })
    },
    [role, trackAssistantEvent],
  )

  const handleRenameConversation = useCallback(
    async (conversationId: string, title: string) => {
      try {
        const updated = await assistantClient.renameConversation(role, conversationId, title)
        setConversations((current) => upsertConversation(current, updated))
        trackAssistantEvent("conversation_renamed", {
          conversationId,
          label: title,
        })
      } catch {
        void loadConversations()
      }
    },
    [loadConversations, role, trackAssistantEvent],
  )

  const handleArchiveConversation = useCallback(
    async (conversationId: string, isArchived: boolean) => {
      try {
        const updated = await assistantClient.archiveConversation(role, conversationId, isArchived)
        const remaining = conversations.filter((conversation) => conversation.id !== conversationId)
        setConversations(remaining)
        trackAssistantEvent(isArchived ? "conversation_archived" : "conversation_restored", {
          conversationId,
        })

        if (selectedConversationId === conversationId && !showArchived) {
          const nextSelected = resolveNextConversationId(remaining, null, null, context)
          setSelectedConversationId(nextSelected)
          persistSelectedConversationId(role, nextSelected)
          if (!nextSelected) {
            setMessages([])
          }
        }

        if (showArchived && updated.isArchived) {
          setConversations((current) => upsertConversation(current, updated))
        }
      } catch {
        void loadConversations()
      }
    },
    [
      context,
      conversations,
      loadConversations,
      role,
      selectedConversationId,
      showArchived,
      trackAssistantEvent,
    ],
  )

  const handlePinConversation = useCallback(
    async (conversationId: string, isPinned: boolean) => {
      try {
        const updated = await assistantClient.pinConversation(role, conversationId, isPinned)
        if (updated) {
          setConversations((current) => upsertConversation(current, updated))
        }
        trackAssistantEvent(isPinned ? "conversation_pinned" : "conversation_unpinned", {
          conversationId,
        })
      } catch {
        void loadConversations()
      }
    },
    [loadConversations, role, trackAssistantEvent],
  )

  const handleDeleteConversation = useCallback(
    async (conversationId: string) => {
      try {
        await assistantClient.deleteConversation(role, conversationId)
        const remaining = conversations.filter((conversation) => conversation.id !== conversationId)
        const nextSelected =
          selectedConversationId === conversationId
            ? resolveNextConversationId(remaining, null, null, context)
            : selectedConversationId

        setConversations(remaining)
        setSelectedConversationId(nextSelected)
        persistSelectedConversationId(role, nextSelected)
        if (selectedConversationId === conversationId) {
          setMessages([])
        }
        trackAssistantEvent("conversation_deleted", {
          conversationId,
        })
      } catch {
        void loadConversations()
      }
    },
    [
      context,
      conversations,
      loadConversations,
      role,
      selectedConversationId,
      trackAssistantEvent,
    ],
  )

  const handleArchiveToggle = useCallback(() => {
    setShowArchived((current) => !current)
    trackAssistantEvent("conversation_scope_changed", {
      metadata: {
        showArchived: !showArchived,
      },
    })
  }, [showArchived, trackAssistantEvent])

  return (
    <div className={styles.root}>
      <AnimatePresence>
        {showWelcome && !isOpen ? (
          <motion.div
            className={styles.welcome}
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <p className={styles.welcomeTitle}>Beer the Bear</p>
            <p className={styles.welcomeCopy}>
              I am live on this page and ready to help with the next step.
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <button
        type="button"
        className={`${styles.trigger} ${isOpen ? styles.triggerActive : ""}`}
        onClick={() => {
          setShowWelcome(false)
          setHasDismissedWelcome(true)
          setIsOpen((current) => !current)
        }}
        aria-label={isOpen ? "Close assistant" : "Open assistant"}
      >
        <span className={styles.triggerGlow} />
        <span className={styles.triggerInner}>
          <BeerAssistantBear
            active={showWelcome}
            fallbackSrc={bearAvatarSrc}
            paused={isOpen}
            variant="trigger"
            onReady={handleBearReady}
          />
        </span>
      </button>

      <AnimatePresence>
        {isOpen ? (
          <>
            <motion.div
              className={styles.backdrop}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />
            <motion.section
              className={styles.panel}
              initial={{ opacity: 0, x: 24, y: 18 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 24, y: 18 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              aria-label="Assistant panel"
            >
              <BeerAssistantSidebar
                conversations={conversations}
                selectedConversationId={selectedConversationId}
                searchValue={searchValue}
                showArchived={showArchived}
                isLoading={isLoadingConversations}
                isGuestMode={isGuestMode}
                modeLabel={modeLabel}
                mobileOpen={mobileSidebarOpen}
                onMobileClose={() => setMobileSidebarOpen(false)}
                onSearchChange={setSearchValue}
                onArchiveToggle={handleArchiveToggle}
                onSelect={handleSelectConversation}
                onCreate={() => {
                  void createConversation()
                }}
                onRename={(conversationId, title) => {
                  void handleRenameConversation(conversationId, title)
                }}
                onDelete={(conversationId) => {
                  void handleDeleteConversation(conversationId)
                }}
                onArchive={(conversationId, isArchived) => {
                  void handleArchiveConversation(conversationId, isArchived)
                }}
                onPin={(conversationId, isPinned) => {
                  void handlePinConversation(conversationId, isPinned)
                }}
              />

              <BeerAssistantWindow
                messages={messages}
                suggestions={suggestions}
                streamingMessage={streamingMessage}
                composerValue={composerValue}
                isSending={isSending}
                isGuestMode={isGuestMode}
                modeLabel={modeLabel}
                pageLabel={pageLabel}
                threadTitle={selectedConversation?.title ?? null}
                contextHints={contextHints}
                avatarSrc={bearAvatarSrc}
                onToggleSidebar={() => setMobileSidebarOpen((current) => !current)}
                onClose={() => setIsOpen(false)}
                onComposerChange={setComposerValue}
                onSend={(nextContent) => {
                  void handleSend(nextContent)
                }}
                onPromptSelect={(prompt) => {
                  void handleSend(prompt, "suggestion")
                }}
                onAction={(action) => {
                  void handleAction(action)
                }}
              />
            </motion.section>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function mergeMessages(current: AssistantMessage[], next: AssistantMessage[]) {
  const map = new Map(current.map((message) => [message.id, message]))

  for (const message of next) {
    map.set(message.id, message)
  }

  return Array.from(map.values()).sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  )
}

function withConversationHistory(
  context: AssistantConversationContext,
  messages: AssistantMessage[],
): AssistantConversationContext {
  const history = messages.slice(-8).map((message) => ({
    actor: message.actor,
    content: message.content,
  }))

  return {
    ...context,
    metadata: {
      ...context.metadata,
      history,
    },
  }
}

function getSelectedConversationStorageKey(role: AssistantWorkspaceRole) {
  return `beer-assistant:selected-conversation:${role}`
}

function readSelectedConversationId(role: AssistantWorkspaceRole) {
  if (typeof window === "undefined") return null

  try {
    return window.localStorage.getItem(getSelectedConversationStorageKey(role))
  } catch {
    return null
  }
}

function persistSelectedConversationId(role: AssistantWorkspaceRole, conversationId: string | null) {
  if (typeof window === "undefined") return

  try {
    const storageKey = getSelectedConversationStorageKey(role)
    if (conversationId) {
      window.localStorage.setItem(storageKey, conversationId)
      return
    }

    window.localStorage.removeItem(storageKey)
  } catch {
    // Ignore storage failures so the assistant keeps working in restricted browsers.
  }
}

function resolveNextConversationId(
  conversations: AssistantConversation[],
  currentConversationId: string | null,
  storedConversationId: string | null,
  context: AssistantConversationContext,
) {
  if (!conversations.length) {
    return null
  }

  const preferredIds = [currentConversationId, storedConversationId].filter(Boolean) as string[]
  for (const candidate of preferredIds) {
    const match = conversations.find((conversation) => conversation.id === candidate)
    if (match) {
      return match.id
    }
  }

  if (context.pagePath) {
    const samePageConversation = conversations.find(
      (conversation) => conversation.pagePath === context.pagePath,
    )
    if (samePageConversation) {
      return samePageConversation.id
    }
  }

  return conversations[0]?.id ?? null
}

function upsertConversation(
  conversations: AssistantConversation[],
  nextConversation: AssistantConversation,
) {
  const remaining = conversations.filter((conversation) => conversation.id !== nextConversation.id)

  return [nextConversation, ...remaining].sort(
    (left, right) =>
      Number(Boolean(right.isPinned)) - Number(Boolean(left.isPinned)) ||
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  )
}
