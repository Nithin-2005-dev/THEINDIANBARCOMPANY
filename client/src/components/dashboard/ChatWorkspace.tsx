"use client"

import { useLayoutEffect, useMemo, useRef } from "react"
import {
  DashboardButton,
  EmptyState,
  InlineNotice,
} from "@/components/dashboard/DashboardPrimitives"
import {
  AttachmentIcon,
  SparklesIcon,
} from "@/components/dashboard/icons"
import type {
  PortalChatParticipant,
  PortalConversationType,
  PortalInboxConversation,
  PortalMessage,
} from "@/types/client-portal"
import styles from "@/components/dashboard/ChatWorkspace.module.css"

export type ChatBookingConversation = PortalInboxConversation
export type ChatMessage = PortalMessage

type ConnectionStatus = {
  label: string
  tone: "connected" | "warning" | "offline"
}

function formatMessageTime(value?: string | null) {
  if (!value) return ""

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function formatConversationTime(value?: string | null) {
  if (!value) return ""

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
  }).format(new Date(value))
}

function getInitials(name?: string | null) {
  if (!name) return "TB"

  return name
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function humanizeStatus(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase()
}

function isImageAttachment(fileName?: string | null, attachmentUrl?: string | null) {
  const target = `${fileName ?? ""} ${attachmentUrl ?? ""}`.toLowerCase()
  return [".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg"].some((extension) =>
    target.includes(extension),
  )
}

function isPdfAttachment(fileName?: string | null, attachmentUrl?: string | null) {
  const target = `${fileName ?? ""} ${attachmentUrl ?? ""}`.toLowerCase()
  return target.includes(".pdf")
}

function getParticipantRoleLabel(participant: PortalChatParticipant) {
  if (participant.role === "CLIENT") return "Client"
  if (participant.role === "ADMIN") return "Admin"
  if (participant.role === "VENDOR") return "Vendor"
  if (participant.role === "SALES") return "Sales"
  if (participant.role === "OPS") return "Operations"
  if (participant.role === "FINANCE") return "Finance"
  return participant.role
}

function getActiveConversation(
  booking: ChatBookingConversation | undefined,
  selectedConversationType?: PortalConversationType,
) {
  if (!booking) return null

  return (
    booking.conversations.find((conversation) => conversation.type === selectedConversationType) ??
    booking.conversations[0] ??
    null
  )
}

function getConversationParticipants(
  booking: ChatBookingConversation,
  activeConversationType?: PortalConversationType,
) {
  const activeConversation =
    booking.conversations.find((conversation) => conversation.type === activeConversationType) ??
    booking.conversations[0] ??
    null

  const source = activeConversation?.participants?.length
    ? activeConversation.participants
    : [
        booking.participants.client,
        ...booking.participants.admins,
        ...booking.participants.staff,
        ...booking.participants.vendors,
      ]

  const uniqueParticipants = new Map<string, PortalChatParticipant>()

  source.forEach((participant) => {
    if (!participant?.id) return
    if (!uniqueParticipants.has(participant.id)) {
      uniqueParticipants.set(participant.id, participant)
    }
  })

  return Array.from(uniqueParticipants.values())
}

function getParticipantRoleSummary(participants: PortalChatParticipant[]) {
  const roles = Array.from(
    new Set(participants.map((participant) => getParticipantRoleLabel(participant))),
  )

  return roles.join(", ")
}

function getMessagePreview(conversation: ChatBookingConversation) {
  if (conversation.lastMessage?.body?.trim()) {
    return conversation.lastMessage.body
  }

  if (conversation.lastMessage?.attachmentUrl) {
    return conversation.lastMessage.attachmentName ?? "Attachment shared"
  }

  return "No messages yet."
}

function renderAttachment(message: ChatMessage) {
  if (!message.attachmentUrl) return null

  if (isImageAttachment(message.attachmentName, message.attachmentUrl)) {
    return (
      <a
        href={message.attachmentUrl}
        target="_blank"
        rel="noreferrer"
        className={styles.imageAttachment}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={message.attachmentUrl}
          alt={message.attachmentName ?? "Message attachment"}
          className={styles.imagePreview}
        />
        <span className={styles.attachmentCaption}>{message.attachmentName ?? "Open image"}</span>
      </a>
    )
  }

  return (
    <a
      href={message.attachmentUrl}
      target="_blank"
      rel="noreferrer"
      className={styles.fileAttachment}
    >
      <AttachmentIcon width={16} height={16} />
      <span>
        {message.attachmentName ??
          (isPdfAttachment(message.attachmentName, message.attachmentUrl)
            ? "Open PDF"
            : "Open attachment")}
      </span>
    </a>
  )
}

function getConnectionClassName(
  tone: ConnectionStatus["tone"],
  styleModule: typeof styles,
) {
  if (tone === "connected") return styleModule.connectionConnected
  if (tone === "warning") return styleModule.connectionWarning
  return styleModule.connectionOffline
}

function getStatusClassName(
  status: ChatBookingConversation["status"],
  styleModule: typeof styles,
) {
  if (status === "ACTIVE") return styleModule.statusActive
  if (status === "COMPLETED") return styleModule.statusCompleted
  return styleModule.statusCancelled
}

export function ChatWorkspace({
  workspaceTitle,
  workspaceDescription,
  connectionStatus,
  title,
  description,
  conversations,
  selectedId,
  selectedConversationType,
  onSelectConversation,
  onSelectConversationType,
  messages,
  isLoadingMessages,
  isLoadingOlderMessages,
  hasMoreMessages,
  onLoadOlderMessages,
  messageLoadMode = "replace",
  composerValue,
  onComposerChange,
  onSubmit,
  listSearchValue,
  onListSearchChange,
  listSearchPlaceholder,
  messageSearchValue,
  onMessageSearchChange,
  messageDateValue,
  onMessageDateChange,
  attachmentsOnly,
  onAttachmentsOnlyChange,
  fileName,
  onFileChange,
  emptySidebarTitle = "No conversations yet",
  emptySidebarText,
  emptyThreadTitle = "Select a booking",
  emptyThreadText,
  activityText,
  createAction,
  sendLabel = "Send",
}: {
  workspaceTitle: string
  workspaceDescription?: string
  connectionStatus?: ConnectionStatus
  title: string
  description?: string
  conversations: ChatBookingConversation[]
  selectedId?: string
  selectedConversationType?: PortalConversationType
  onSelectConversation: (id: string) => void
  onSelectConversationType: (conversationType: PortalConversationType) => void
  messages: ChatMessage[]
  isLoadingMessages?: boolean
  isLoadingOlderMessages?: boolean
  hasMoreMessages?: boolean
  onLoadOlderMessages?: () => void | Promise<void>
  messageLoadMode?: "replace" | "prepend"
  composerValue: string
  onComposerChange: (value: string) => void
  onSubmit: () => void | Promise<void>
  listSearchValue: string
  onListSearchChange: (value: string) => void
  listSearchPlaceholder: string
  messageSearchValue: string
  onMessageSearchChange: (value: string) => void
  messageDateValue: string
  onMessageDateChange: (value: string) => void
  attachmentsOnly: boolean
  onAttachmentsOnlyChange: (value: boolean) => void
  fileName?: string | null
  onFileChange?: (file: File | null) => void
  emptySidebarTitle?: string
  emptySidebarText: string
  emptyThreadTitle?: string
  emptyThreadText: string
  activityText?: string | null
  createAction?: {
    label: string
    href?: string
    onClick?: () => void
  }
  sendLabel?: string
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messageListRef = useRef<HTMLDivElement>(null)
  const previousScrollHeightRef = useRef(0)
  const selectedConversation = conversations.find((conversation) => conversation.leadId === selectedId)
  const activeChannel = useMemo(
    () => getActiveConversation(selectedConversation, selectedConversationType),
    [selectedConversation, selectedConversationType],
  )
  const activeParticipants = useMemo(
    () =>
      selectedConversation
        ? getConversationParticipants(selectedConversation, activeChannel?.type)
        : [],
    [activeChannel?.type, selectedConversation],
  )
  const roleSummary = useMemo(
    () => getParticipantRoleSummary(activeParticipants),
    [activeParticipants],
  )

  useLayoutEffect(() => {
    if (!messageListRef.current) return
    const node = messageListRef.current

    if (messageLoadMode === "prepend") {
      node.scrollTop += node.scrollHeight - previousScrollHeightRef.current
    } else {
      node.scrollTop = node.scrollHeight
    }

    previousScrollHeightRef.current = node.scrollHeight
  }, [messageLoadMode, messages.length, selectedConversationType, selectedId])

  return (
    <div className={styles.workspaceShell}>
      <header className={styles.workspaceHeader}>
        <div className={styles.workspaceCopy}>
          <h1 className={styles.workspaceTitle}>{workspaceTitle}</h1>
          {workspaceDescription ? (
            <p className={styles.workspaceDescription}>{workspaceDescription}</p>
          ) : null}
        </div>
        {connectionStatus ? (
          <span
            className={`${styles.connectionBadge} ${getConnectionClassName(connectionStatus.tone, styles)}`.trim()}
          >
            <span className={styles.connectionDot} aria-hidden="true" />
            <span>{connectionStatus.label}</span>
          </span>
        ) : null}
      </header>

      <div className={styles.layout}>
        <aside className={styles.threadRail}>
          <div className={styles.threadRailHeader}>
            <div>
              <h2 className={styles.railTitle}>{title}</h2>
              {description ? <p className={styles.railDescription}>{description}</p> : null}
            </div>
            <span className={styles.railCount}>{conversations.length}</span>
          </div>

          <div className={styles.listSearch}>
            <input
              type="search"
              value={listSearchValue}
              onChange={(event) => onListSearchChange(event.target.value)}
              placeholder={listSearchPlaceholder}
              className={styles.listSearchInput}
              aria-label={listSearchPlaceholder}
            />
          </div>

          {conversations.length ? (
            <div className={styles.threadList}>
              {conversations.map((conversation) => {
                const isActive = selectedId === conversation.leadId
                const lastActivity =
                  conversation.lastMessage?.createdAt ?? conversation.updatedAt ?? conversation.eventDate

                return (
                  <button
                    key={conversation.leadId}
                    type="button"
                    onClick={() => onSelectConversation(conversation.leadId)}
                    className={`${styles.threadItem} ${isActive ? styles.threadItemActive : ""}`.trim()}
                  >
                    <span className={styles.threadAvatar}>
                      {getInitials(conversation.title)}
                    </span>
                    <span className={styles.threadContent}>
                      <span className={styles.threadTopRow}>
                        <span className={styles.threadName}>{conversation.title}</span>
                        <span className={styles.threadTimestamp}>
                          {formatConversationTime(lastActivity)}
                        </span>
                      </span>
                      <span className={styles.threadPreview}>
                        {getMessagePreview(conversation)}
                      </span>
                      <span className={styles.threadMeta}>
                        <span>{formatEventDate(conversation.eventDate)}</span>
                        <span>{conversation.location}</span>
                      </span>
                    </span>
                    {conversation.unreadCount ? (
                      <span className={styles.unreadBadge}>{conversation.unreadCount}</span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className={styles.railEmpty}>
              <EmptyState
                title={emptySidebarTitle}
                description={emptySidebarText}
                action={createAction}
              />
            </div>
          )}
        </aside>

        <section className={styles.chatStage}>
          {!selectedConversation ? (
            <div className={styles.stageEmpty}>
              <EmptyState
                title={emptyThreadTitle}
                description={emptyThreadText}
                action={createAction}
                align="center"
              />
            </div>
          ) : (
            <>
              <header className={styles.chatHeader}>
                <div className={styles.chatHeaderMain}>
                  <div className={styles.chatHeadingRow}>
                    <h2 className={styles.chatTitle}>{selectedConversation.title}</h2>
                    <div className={styles.chatPills}>
                      <span className={styles.metaPill}>
                        {formatEventDate(selectedConversation.eventDate)}
                      </span>
                      <span
                        className={`${styles.statusTag} ${getStatusClassName(selectedConversation.status, styles)}`.trim()}
                      >
                        {humanizeStatus(selectedConversation.status)}
                      </span>
                    </div>
                  </div>
                  <p className={styles.chatSubtitle}>{selectedConversation.location}</p>
                  <p className={styles.chatContext}>
                    {activeParticipants.length} participant{activeParticipants.length === 1 ? "" : "s"}
                    {roleSummary ? `: ${roleSummary}` : ""}
                  </p>
                  {activeParticipants.length ? (
                    <div className={styles.participantStrip}>
                      {activeParticipants.map((participant) => (
                        <div key={participant.id} className={styles.participantChip}>
                          <span className={styles.participantAvatar}>
                            {getInitials(participant.name ?? participant.role)}
                          </span>
                          <span className={styles.participantInfo}>
                            <span className={styles.participantName}>
                              {participant.name ??
                                participant.email ??
                                participant.phone ??
                                getParticipantRoleLabel(participant)}
                            </span>
                            <span className={styles.participantRole}>
                              {getParticipantRoleLabel(participant)}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className={styles.chatHeaderSide}>
                  {activeChannel ? (
                    <span className={styles.metaPill}>{activeChannel.label}</span>
                  ) : null}
                  {activityText ? <p className={styles.typingLabel}>{activityText}</p> : null}
                </div>
              </header>

              {selectedConversation.conversations.length > 1 ? (
                <div className={styles.channelRow} role="tablist" aria-label="Conversation channels">
                  {selectedConversation.conversations.map((conversation) => {
                    const isActive = activeChannel?.type === conversation.type

                    return (
                      <button
                        key={conversation.type}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onSelectConversationType(conversation.type)}
                        className={`${styles.channelButton} ${isActive ? styles.channelButtonActive : ""}`.trim()}
                      >
                        <span className={styles.channelLabel}>{conversation.label}</span>
                        <span className={styles.channelDescription}>
                          {conversation.description}
                        </span>
                        {conversation.unreadCount ? (
                          <span className={styles.channelBadge}>{conversation.unreadCount}</span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              ) : null}

              <div className={styles.messageTools}>
                <input
                  type="search"
                  value={messageSearchValue}
                  onChange={(event) => onMessageSearchChange(event.target.value)}
                  placeholder="Search messages"
                  className={styles.messageToolInput}
                />
                <input
                  type="date"
                  value={messageDateValue}
                  onChange={(event) => onMessageDateChange(event.target.value)}
                  className={`${styles.messageToolInput} ${styles.dateInput}`.trim()}
                />
                <label className={styles.messageToolToggle}>
                  <input
                    type="checkbox"
                    checked={attachmentsOnly}
                    onChange={(event) => onAttachmentsOnlyChange(event.target.checked)}
                  />
                  <span>Attachments only</span>
                </label>
              </div>

              <div className={styles.messageViewport}>
                {isLoadingMessages ? (
                  <div className={styles.messageList}>
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className={`${styles.messageBubble} ${styles.messageSkeleton}`.trim()} />
                    ))}
                  </div>
                ) : messages.length ? (
                  <>
                    {hasMoreMessages ? (
                      <div className={styles.loadOlderRow}>
                        <DashboardButton
                          type="button"
                          onClick={() => void onLoadOlderMessages?.()}
                          disabled={isLoadingOlderMessages}
                          tone="secondary"
                        >
                          {isLoadingOlderMessages
                            ? "Loading earlier messages..."
                            : "Load earlier messages"}
                        </DashboardButton>
                      </div>
                    ) : null}

                    <div ref={messageListRef} className={styles.messageList}>
                      {messages.map((message) => {
                        const isSystem = message.type === "SYSTEM"
                        const isClient = message.sender?.role === "CLIENT"
                        const alignmentClass = isSystem
                          ? styles.messageSystem
                          : isClient
                            ? styles.messageOutgoing
                            : styles.messageIncoming

                        return (
                          <article
                            key={message.id}
                            className={`${styles.messageRow} ${alignmentClass}`.trim()}
                          >
                            {!isSystem ? (
                              <div className={styles.bubbleAvatar}>
                                {getInitials(message.sender?.name ?? message.sender?.role)}
                              </div>
                            ) : null}

                            <div className={styles.messageBubble}>
                              <div className={styles.messageTop}>
                                <div>
                                  <p className={styles.messageSender}>
                                    {message.sender?.name ?? "System"}
                                  </p>
                                  <p className={styles.messageRole}>
                                    {message.sender
                                      ? getParticipantRoleLabel(message.sender)
                                      : "System update"}
                                  </p>
                                </div>
                                <span className={styles.messageTime}>
                                  {formatMessageTime(message.createdAt)}
                                </span>
                              </div>

                              <p className={styles.messageBody}>{message.body}</p>
                              {renderAttachment(message)}
                              {message.readAt ? (
                                <p className={styles.readReceipt}>
                                  Seen {formatMessageTime(message.readAt)}
                                </p>
                              ) : null}
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <div className={styles.stageEmpty}>
                    <EmptyState
                      title="No messages yet"
                      description={
                        activeChannel?.description ??
                        "Open a booking conversation to view messages here."
                      }
                      align="center"
                    />
                  </div>
                )}
              </div>

              {!selectedConversation.canSend ? (
                <InlineNotice
                  tone={selectedConversation.status === "CANCELLED" ? "error" : "warning"}
                  title="Conversation archived"
                  description={
                    selectedConversation.readOnlyMessage ??
                    "This conversation is read-only. Replies are disabled."
                  }
                />
              ) : null}

              <div
                className={`${styles.composer} ${!selectedConversation.canSend ? styles.composerDisabled : ""}`.trim()}
              >
                <div className={styles.composerBar}>
                  {onFileChange ? (
                    <>
                      <button
                        type="button"
                        className={styles.iconButton}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!selectedConversation.canSend}
                        aria-label="Attach a file"
                      >
                        <AttachmentIcon width={18} height={18} />
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className={styles.fileInput}
                        onChange={(event) =>
                          onFileChange(event.target.files?.[0] ?? null)
                        }
                        disabled={!selectedConversation.canSend}
                      />
                    </>
                  ) : null}

                  <textarea
                    id="booking-chat-message"
                    className={styles.textarea}
                    placeholder={
                      selectedConversation.canSend
                        ? "Write a message about this booking."
                        : selectedConversation.readOnlyMessage ??
                          "Replies are disabled for this conversation."
                    }
                    value={composerValue}
                    onChange={(event) => onComposerChange(event.target.value)}
                    disabled={!selectedConversation.canSend}
                    rows={1}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault()
                        if (selectedConversation.canSend && composerValue.trim()) {
                          void onSubmit()
                        }
                      }
                    }}
                  />

                  <DashboardButton
                    onClick={() => void onSubmit()}
                    disabled={!selectedConversation.canSend || !composerValue.trim()}
                    className={styles.sendButton}
                  >
                    <SparklesIcon width={16} height={16} />
                    <span>{sendLabel}</span>
                  </DashboardButton>
                </div>

                <div className={styles.composerFooter}>
                  {fileName ? (
                    <span className={styles.fileChip}>{fileName}</span>
                  ) : (
                    <span className={styles.helperText}>
                      Press Enter to send. Use Shift + Enter for a new line.
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
