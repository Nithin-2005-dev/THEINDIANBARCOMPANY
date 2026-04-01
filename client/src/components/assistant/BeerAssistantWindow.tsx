"use client"

import { useEffect, useRef } from "react"
import BeerAssistantAvatar from "@/components/assistant/BeerAssistantAvatar"
import { AttachmentIcon } from "@/components/dashboard/icons"
import { CloseIcon, SendIcon } from "@/components/assistant/AssistantIcons"
import BeerAssistantMessageBubble from "@/components/assistant/BeerAssistantMessageBubble"
import BeerAssistantPromptSuggestions from "@/components/assistant/BeerAssistantPromptSuggestions"
import BeerAssistantTypingState from "@/components/assistant/BeerAssistantTypingState"
import styles from "@/components/assistant/BeerAssistantWindow.module.css"
import type {
  AssistantAction,
  AssistantMessage,
  AssistantPromptSuggestion,
} from "@/types/assistant"

type BeerAssistantWindowProps = {
  messages: AssistantMessage[]
  suggestions: AssistantPromptSuggestion[]
  streamingMessage: string
  composerValue: string
  isSending: boolean
  isGuestMode: boolean
  modeLabel: string
  pageLabel: string
  threadTitle?: string | null
  contextHints?: string[]
  avatarSrc?: string | null
  onToggleSidebar?: () => void
  onClose?: () => void
  onComposerChange: (value: string) => void
  onSend: (content: string) => void
  onPromptSelect: (prompt: string) => void
  onAction: (action: AssistantAction) => void
}

export default function BeerAssistantWindow({
  messages,
  suggestions,
  streamingMessage,
  composerValue,
  isSending,
  isGuestMode,
  modeLabel,
  pageLabel,
  threadTitle,
  contextHints = [],
  avatarSrc,
  onToggleSidebar,
  onClose,
  onComposerChange,
  onSend,
  onPromptSelect,
  onAction,
}: BeerAssistantWindowProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const hasMessages = messages.length > 0 || Boolean(streamingMessage)

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, streamingMessage, suggestions])

  return (
    <section className={styles.window}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.identity}>
            <BeerAssistantAvatar src={avatarSrc} className={styles.avatar} />
            <div className={styles.identityCopy}>
              <p className={styles.title}>Beer the Bear</p>
              <p className={styles.status}>Context-aware assistant tuned to your current page</p>
            </div>
          </div>
          <div className={styles.headerActions}>
            <span className={`${styles.badge} ${styles.modeBadge}`}>
              {isGuestMode ? "Public site" : modeLabel}
            </span>
            {onToggleSidebar ? (
              <button
                type="button"
                className={styles.sidebarButton}
                onClick={onToggleSidebar}
              >
                Chats
              </button>
            ) : null}
            {onClose ? (
              <button
                type="button"
                className={styles.closeButton}
                onClick={onClose}
                aria-label="Close assistant"
              >
                <CloseIcon width={15} height={15} />
              </button>
            ) : null}
          </div>
        </div>
        <div className={styles.headerMeta}>
          <span className={styles.badge}>{pageLabel}</span>
          {threadTitle ? (
            <span className={`${styles.badge} ${styles.badgeMuted}`}>{threadTitle}</span>
          ) : null}
        </div>
        {contextHints.length ? (
          <div className={styles.contextRail}>
            <span className={styles.contextLabel}>Context</span>
            {contextHints.map((hint, index) => (
              <span key={`${hint}-${index}`} className={styles.contextBadge}>
                {hint}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      <div className={styles.body} ref={scrollRef}>
        {suggestions.length > 0 ? (
          <section className={styles.promptPanel} aria-label="Suggested prompts">
            <div className={styles.promptHeader}>
              <p className={styles.promptEyebrow}>Quick prompts</p>
              <p className={styles.promptCopy}>Jump straight to a useful next step.</p>
            </div>
            <BeerAssistantPromptSuggestions
              suggestions={suggestions.slice(0, 4)}
              onSelect={onPromptSelect}
            />
          </section>
        ) : null}

        {!hasMessages ? (
          <div className={styles.empty}>
            <BeerAssistantAvatar src={avatarSrc} className={styles.emptyOrb} />
            <div className={styles.emptyCopy}>
              <h3 className={styles.emptyTitle}>Ask for the next move.</h3>
              <p className={styles.emptyText}>
                {isGuestMode
                  ? "I can explain this page, suggest the right service, and move you into booking without the usual wandering."
                  : modeLabel === "Admin mode"
                    ? "I can show what needs attention, surface unread chats, highlight overdue work, and draft a clean handoff."
                    : modeLabel === "Staff mode"
                      ? "I can help with assigned work, pending tasks, missing uploads, and quick updates."
                      : modeLabel === "Vendor mode"
                        ? "I can help with assignments, schedules, payment release items, and delivery follow-up."
                        : "I can summarize what matters here, surface what is pending, draft a reply, and point you straight to the right screen."}
              </p>
              {!isGuestMode ? (
                <p className={styles.emptyHint}>
                  Try a greeting, a status question, or a draft request.
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className={styles.messages}>
            {messages.map((message) => (
              <BeerAssistantMessageBubble
                key={message.id}
                message={message}
                avatarSrc={avatarSrc}
                onAction={onAction}
              />
            ))}
            {streamingMessage ? (
              <BeerAssistantMessageBubble
                message={{
                  id: "streaming",
                  actor: "ASSISTANT",
                  content: streamingMessage,
                  actions: [],
                  createdAt: new Date().toISOString(),
                }}
                avatarSrc={avatarSrc}
                onAction={onAction}
              />
            ) : null}
            {isSending && !streamingMessage ? (
              <BeerAssistantTypingState avatarSrc={avatarSrc} />
            ) : null}
          </div>
        )}
      </div>

      <div className={styles.composerWrap}>
        <form
          className={styles.composer}
          onSubmit={(event) => {
            event.preventDefault()
            onSend(composerValue)
          }}
        >
          <textarea
            className={styles.textarea}
            placeholder={
              isGuestMode
                ? "Ask about this page, service, or booking step..."
                : "Ask for a summary, draft, pending list, or shortcut..."
            }
            value={composerValue}
            onChange={(event) => onComposerChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey) return
              event.preventDefault()
              onSend(composerValue)
            }}
          />
          <button
            type="button"
            className={styles.ghostButton}
            disabled
            title="File upload is planned next"
            aria-label="File upload coming soon"
          >
            <AttachmentIcon width={16} height={16} />
          </button>
          <button
            type="submit"
            className={styles.sendButton}
            disabled={isSending || !composerValue.trim()}
            aria-label="Send message"
          >
            <SendIcon width={16} height={16} />
          </button>
        </form>
        <p className={styles.hint}>Enter sends. Shift + Enter adds a new line.</p>
      </div>
    </section>
  )
}
