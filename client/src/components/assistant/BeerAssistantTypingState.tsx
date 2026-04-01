import BeerAssistantAvatar from "@/components/assistant/BeerAssistantAvatar"
import styles from "@/components/assistant/BeerAssistantTypingState.module.css"

type BeerAssistantTypingStateProps = {
  avatarSrc?: string | null
}

export default function BeerAssistantTypingState({
  avatarSrc,
}: BeerAssistantTypingStateProps) {
  return (
    <div className={styles.bubble}>
      <div className={styles.header}>
        <BeerAssistantAvatar src={avatarSrc} className={styles.avatar} />
        <div className={styles.label}>Beer</div>
      </div>
      <div className={styles.dots} aria-label="Assistant is typing">
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}
