"use client"

import { useMemo, useState } from "react"
import {
  ArchiveIcon,
  CloseIcon,
  EditIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from "@/components/assistant/AssistantIcons"
import BeerAssistantLoadingState from "@/components/assistant/BeerAssistantLoadingState"
import styles from "@/components/assistant/BeerAssistantSidebar.module.css"
import type { AssistantConversation } from "@/types/assistant"

type BeerAssistantSidebarProps = {
  conversations: AssistantConversation[]
  selectedConversationId: string | null
  searchValue: string
  showArchived: boolean
  isLoading: boolean
  isGuestMode: boolean
  modeLabel: string
  mobileOpen: boolean
  onMobileClose: () => void
  onSearchChange: (value: string) => void
  onArchiveToggle: () => void
  onSelect: (conversationId: string) => void
  onCreate: () => void
  onRename: (conversationId: string, title: string) => void
  onDelete: (conversationId: string) => void
  onArchive: (conversationId: string, isArchived: boolean) => void
  onPin: (conversationId: string, isPinned: boolean) => void
}

type ConversationGroup = {
  label: string
  conversations: AssistantConversation[]
}

export default function BeerAssistantSidebar({
  conversations,
  selectedConversationId,
  searchValue,
  showArchived,
  isLoading,
  isGuestMode,
  modeLabel,
  mobileOpen,
  onMobileClose,
  onSearchChange,
  onArchiveToggle,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onArchive,
  onPin,
}: BeerAssistantSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState("")
  const groups = useMemo(() => buildConversationGroups(conversations), [conversations])
  const conversationCount = conversations.length

  const subtitle = showArchived
    ? `${conversationCount} archived thread${conversationCount === 1 ? "" : "s"} kept for later.`
    : isGuestMode
      ? `${conversationCount} thread${conversationCount === 1 ? "" : "s"} stored on this device.`
      : `${conversationCount} synced thread${conversationCount === 1 ? "" : "s"} in this workspace.`

  return (
    <aside
      className={`${styles.sidebar} ${mobileOpen ? styles.mobileOpen : styles.mobileClosed}`}
    >
      <div className={styles.header}>
        <div className={styles.headerCopy}>
          <p className={styles.eyebrow}>{modeLabel}</p>
          <h2 className={styles.title}>{showArchived ? "Archived chats" : "Recent chats"}</h2>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.mobileClose}
            onClick={onMobileClose}
            aria-label="Close conversations"
          >
            <CloseIcon width={15} height={15} />
          </button>
          <button
            type="button"
            className={styles.newButton}
            onClick={onCreate}
            aria-label="Start a new conversation"
          >
            <PlusIcon width={16} height={16} />
          </button>
        </div>
      </div>

      <div className={styles.toolbar}>
        <button
          type="button"
          className={`${styles.scopeButton} ${!showArchived ? styles.scopeActive : ""}`}
          onClick={() => {
            if (showArchived) onArchiveToggle()
          }}
        >
          Active
        </button>
        <button
          type="button"
          className={`${styles.scopeButton} ${showArchived ? styles.scopeActive : ""}`}
          onClick={() => {
            if (!showArchived) onArchiveToggle()
          }}
        >
          Archived
        </button>
      </div>

      <div className={styles.searchWrap}>
        <SearchIcon width={16} height={16} className={styles.searchIcon} />
        <input
          className={styles.searchInput}
          placeholder="Search previous chats"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className={styles.list}>
        {isLoading ? <BeerAssistantLoadingState /> : null}
        {!isLoading && !groups.length ? (
          <div className={styles.empty}>
            {searchValue.trim()
              ? `No chats matched "${searchValue.trim()}". Try a shorter keyword or clear search.`
              : isGuestMode
                ? "Guest threads stay on this device so you can keep browsing without losing the thread."
                : showArchived
                  ? "Archived threads land here so the main workspace stays clean."
                  : "Your synced threads stay here with search, rename, pinning, and archive controls."}
          </div>
        ) : null}

        {!isLoading
          ? groups.map((group) => (
              <section key={group.label} className={styles.group}>
                <p className={styles.groupLabel}>{group.label}</p>
                <div className={styles.groupItems}>
                  {group.conversations.map((conversation) => {
                    const isActive = conversation.id === selectedConversationId
                    const isEditing = editingId === conversation.id

                    return (
                      <div
                        key={conversation.id}
                        className={`${styles.item} ${isActive ? styles.active : ""}`}
                        onClick={() => {
                          if (!isEditing) {
                            onSelect(conversation.id)
                          }
                        }}
                      >
                        <div className={styles.itemHeader}>
                          {isEditing ? (
                            <input
                              autoFocus
                              className={styles.renameInput}
                              value={draftTitle}
                              onChange={(event) => setDraftTitle(event.target.value)}
                              onBlur={() => {
                                const nextTitle = draftTitle.trim()
                                if (nextTitle) onRename(conversation.id, nextTitle)
                                setEditingId(null)
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  const nextTitle = draftTitle.trim()
                                  if (nextTitle) onRename(conversation.id, nextTitle)
                                  setEditingId(null)
                                }
                                if (event.key === "Escape") {
                                  setEditingId(null)
                                }
                              }}
                            />
                          ) : (
                            <>
                              <div className={styles.itemTitleWrap}>
                                {conversation.isPinned ? (
                                  <span className={styles.pinBadge}>
                                    <PinIcon width={12} height={12} />
                                  </span>
                                ) : null}
                                <div className={styles.itemTitle}>{conversation.title}</div>
                              </div>
                              <div className={styles.itemActions}>
                                <button
                                  type="button"
                                  className={styles.iconButton}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    onPin(conversation.id, !conversation.isPinned)
                                  }}
                                  aria-label={conversation.isPinned ? "Unpin conversation" : "Pin conversation"}
                                  title={conversation.isPinned ? "Unpin conversation" : "Pin conversation"}
                                >
                                  <PinIcon width={14} height={14} />
                                </button>
                                <button
                                  type="button"
                                  className={styles.iconButton}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    setEditingId(conversation.id)
                                    setDraftTitle(conversation.title)
                                  }}
                                  aria-label="Rename conversation"
                                  title="Rename conversation"
                                >
                                  <EditIcon width={14} height={14} />
                                </button>
                                <button
                                  type="button"
                                  className={styles.iconButton}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    onArchive(conversation.id, !conversation.isArchived)
                                  }}
                                  aria-label={conversation.isArchived ? "Restore conversation" : "Archive conversation"}
                                  title={conversation.isArchived ? "Restore conversation" : "Archive conversation"}
                                >
                                  <ArchiveIcon width={14} height={14} />
                                </button>
                                <button
                                  type="button"
                                  className={styles.iconButton}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    onDelete(conversation.id)
                                  }}
                                  aria-label="Delete conversation"
                                  title="Delete conversation"
                                >
                                  <TrashIcon width={14} height={14} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                        {!isEditing ? (
                          <div className={styles.itemPreview}>{conversation.preview ?? "No messages yet."}</div>
                        ) : null}
                        {!isEditing ? (
                          <div className={styles.itemMeta}>
                            <span>{conversation.pageTitle ?? "Workspace thread"}</span>
                            <span title={formatConversationExactTimestamp(conversation.updatedAt)}>
                              Updated {formatConversationTimestamp(conversation.updatedAt)}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </section>
            ))
          : null}
      </div>
    </aside>
  )
}

function buildConversationGroups(conversations: AssistantConversation[]): ConversationGroup[] {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)
  const startOfWeek = new Date(startOfToday)
  startOfWeek.setDate(startOfWeek.getDate() - 6)

  const pinned = conversations.filter((conversation) => conversation.isPinned)
  const regular = conversations.filter((conversation) => !conversation.isPinned)
  const groups: ConversationGroup[] = []

  if (pinned.length) {
    groups.push({ label: "Pinned", conversations: pinned })
  }

  const buckets = new Map<string, AssistantConversation[]>()
  for (const conversation of regular) {
    const updatedAt = new Date(conversation.updatedAt)
    const bucket =
      updatedAt >= startOfToday
        ? "Today"
        : updatedAt >= startOfYesterday
          ? "Yesterday"
          : updatedAt >= startOfWeek
            ? "This week"
            : "Older"
    const current = buckets.get(bucket) ?? []
    current.push(conversation)
    buckets.set(bucket, current)
  }

  for (const label of ["Today", "Yesterday", "This week", "Older"]) {
    const bucket = buckets.get(label)
    if (bucket?.length) {
      groups.push({ label, conversations: bucket })
    }
  }

  return groups
}

function formatSidebarTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "just now"
  }

  const diffMinutes = Math.round((date.getTime() - Date.now()) / 60_000)
  const relativeTime = new Intl.RelativeTimeFormat("en-IN", { numeric: "auto" })

  if (Math.abs(diffMinutes) < 60) {
    return relativeTime.format(diffMinutes, "minute")
  }

  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) {
    return relativeTime.format(diffHours, "hour")
  }

  const diffDays = Math.round(diffHours / 24)
  if (Math.abs(diffDays) < 7) {
    return relativeTime.format(diffDays, "day")
  }

  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
  }).format(date)
}

function formatConversationTimestamp(value: string) {
  return formatSidebarTime(value)
}

function formatConversationExactTimestamp(value: string) {
  const date = new Date(value)

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}
