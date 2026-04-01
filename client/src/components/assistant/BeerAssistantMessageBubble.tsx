import BeerMarkdown from "@/components/assistant/BeerMarkdown"
import BeerAssistantAvatar from "@/components/assistant/BeerAssistantAvatar"
import styles from "@/components/assistant/BeerAssistantMessageBubble.module.css"
import type { AssistantAction, AssistantMessage } from "@/types/assistant"

type BeerAssistantMessageBubbleProps = {
  message: AssistantMessage
  avatarSrc?: string | null
  onAction: (action: AssistantAction) => void
}

export default function BeerAssistantMessageBubble({
  message,
  avatarSrc,
  onAction,
}: BeerAssistantMessageBubbleProps) {
  const isUser = message.actor === "USER"
  const label = isUser ? "You" : "Beer"
  const responseStyle = isUser ? null : getResponseStyle(message.metadata)
  const cardStyleClass = responseStyle ? cardStyleMap[responseStyle] ?? null : null
  const actionStyleClass = responseStyle ? actionStyleMap[responseStyle] ?? null : null

  return (
    <article className={`${styles.message} ${isUser ? styles.user : styles.assistant}`}>
      <div className={`${styles.card} ${cardStyleClass ?? ""}`.trim()}>
        <div className={styles.meta}>
          <span className={styles.author}>
            {!isUser ? (
              <BeerAssistantAvatar src={avatarSrc} className={styles.avatar} />
            ) : null}
            <span>{label}</span>
          </span>
          <span className={styles.time}>{formatMessageTime(message.createdAt)}</span>
        </div>
        <BeerMarkdown content={message.content} />
        {message.actions.length ? (
          <div className={styles.actions}>
            {message.actions.map((action) => (
              <button
                key={action.id}
                type="button"
                className={`${styles.action} ${actionStyleClass ?? ""}`.trim()}
                onClick={() => onAction(action)}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  )
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

function getResponseStyle(metadata?: Record<string, unknown> | null) {
  const responseStyle = metadata?.responseStyle
  return typeof responseStyle === "string" ? responseStyle : null
}

const actionStyleMap: Record<string, string> = {
  greeting: styles.actionGreeting,
  identity: styles.actionIdentity,
  capability: styles.actionCapability,
  direct_answer: styles.actionDirectAnswer,
  booking_recommendation: styles.actionRecommendation,
  clarification: styles.actionClarification,
  follow_up: styles.actionFollowUp,
  escalation: styles.actionEscalation,
  unsupported_request: styles.actionUnsupported,
  summary: styles.actionSummary,
  draft: styles.actionDraft,
  action_result: styles.actionResult,
}

const cardStyleMap: Record<string, string> = {
  greeting: styles.cardGreeting,
  identity: styles.cardIdentity,
  capability: styles.cardCapability,
  direct_answer: styles.cardDirectAnswer,
  booking_recommendation: styles.cardRecommendation,
  clarification: styles.cardClarification,
  follow_up: styles.cardFollowUp,
  escalation: styles.cardEscalation,
  unsupported_request: styles.cardUnsupported,
  summary: styles.cardSummary,
  draft: styles.cardDraft,
  action_result: styles.cardResult,
}
