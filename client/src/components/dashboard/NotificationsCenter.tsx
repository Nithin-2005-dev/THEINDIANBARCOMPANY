"use client"

import type { CSSProperties } from "react"
import {
  DashboardButton,
  EmptyState,
  Surface,
} from "@/components/dashboard/DashboardPrimitives"
import styles from "@/components/dashboard/NotificationsCenter.module.css"
import { formatDate, formatRelativeDate } from "@/lib/admin-format"

type NotificationItem = {
  id: string
  title: string
  body: string
  actionUrl?: string | null
  readAt?: string | null
  createdAt: string
}

function groupNotifications(items: NotificationItem[]) {
  const today: NotificationItem[] = []
  const thisWeek: NotificationItem[] = []
  const earlier: NotificationItem[] = []
  const now = Date.now()

  for (const item of items) {
    const diffDays = Math.floor((now - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays <= 0) {
      today.push(item)
    } else if (diffDays <= 7) {
      thisWeek.push(item)
    } else {
      earlier.push(item)
    }
  }

  return [
    { label: "Today", items: today },
    { label: "This Week", items: thisWeek },
    { label: "Earlier", items: earlier },
  ].filter((group) => group.items.length)
}

export function NotificationsCenter({
  title,
  description,
  notifications,
  onMarkRead,
  emptyTitle,
  emptyDescription,
  getItemStyle,
}: {
  title: string
  description: string
  notifications: NotificationItem[]
  onMarkRead: (id: string) => Promise<void> | void
  emptyTitle: string
  emptyDescription: string
  getItemStyle?: (notification: NotificationItem) => CSSProperties | undefined
}) {
  const grouped = groupNotifications(notifications)

  return (
    <Surface title={title} description={description}>
      {notifications.length ? (
        <div className={styles.groups}>
          {grouped.map((group) => (
            <section key={group.label} className={styles.group}>
              <div className={styles.groupHeader}>
                <p className={styles.groupTitle}>{group.label}</p>
                <span className={styles.groupCount}>{group.items.length}</span>
              </div>
              <div className={styles.list}>
                {group.items.map((notification) => (
                  <article
                    key={notification.id}
                    className={`${styles.card} ${!notification.readAt ? styles.cardUnread : ""}`.trim()}
                    style={getItemStyle?.(notification)}
                  >
                    <div className={styles.cardHeader}>
                      <div>
                        <p className={styles.title}>{notification.title}</p>
                        <p className={styles.body}>{notification.body}</p>
                        <p className={styles.meta}>
                          {formatRelativeDate(notification.createdAt)} | {formatDate(notification.createdAt)}
                        </p>
                      </div>
                      <span className={`${styles.status} ${notification.readAt ? styles.statusRead : styles.statusUnread}`.trim()}>
                        {notification.readAt ? "Read" : "Unread"}
                      </span>
                    </div>

                    <div className={styles.actions}>
                      {!notification.readAt ? (
                        <DashboardButton
                          tone="secondary"
                          onClick={() => void onMarkRead(notification.id)}
                        >
                          Mark as read
                        </DashboardButton>
                      ) : null}
                      {notification.actionUrl ? (
                        <DashboardButton
                          tone="primary"
                          onClick={() => {
                            window.location.href = notification.actionUrl!
                          }}
                        >
                          Open linked item
                        </DashboardButton>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      )}
    </Surface>
  )
}
