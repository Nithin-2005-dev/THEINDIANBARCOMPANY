import styles from "@/components/assistant/BeerAssistantLoadingState.module.css"

export default function BeerAssistantLoadingState() {
  return (
    <div className={styles.panel} aria-hidden="true">
      <div className={`${styles.row} ${styles.short}`} />
      <div className={`${styles.row} ${styles.long}`} />
      <div className={`${styles.row} ${styles.medium}`} />
    </div>
  )
}
