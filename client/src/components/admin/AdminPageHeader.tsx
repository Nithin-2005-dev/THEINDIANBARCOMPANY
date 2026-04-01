import styles from "@/components/admin/AdminPageHeader.module.css"

type AdminPageHeaderProps = {
  title: string
  description: string
  action?: React.ReactNode
}

export default function AdminPageHeader({
  title,
  description,
  action,
}: AdminPageHeaderProps) {
  return (
    <div className={styles.root}>
      <div className={styles.body}>
        <p className={styles.eyebrow}>Operations</p>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.description}>{description}</p>
      </div>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  )
}
