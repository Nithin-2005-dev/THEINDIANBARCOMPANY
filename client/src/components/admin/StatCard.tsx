import styles from "@/components/admin/StatCard.module.css"

type StatCardProps = {
  label: string
  value: string | number
  hint?: string
}

export default function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className={styles.card}>
      <p className={styles.label}>{label}</p>
      <p className={styles.value}>{value}</p>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </div>
  )
}
