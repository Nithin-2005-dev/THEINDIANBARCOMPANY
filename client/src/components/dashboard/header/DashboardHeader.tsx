"use client"

import Link from "next/link"
import {
  MenuIcon,
  MessagesIcon,
  NotificationsIcon,
} from "@/components/dashboard/icons"
import { type DashboardThemeKey } from "@/components/dashboard/dashboard-theme"
import type {
  DashboardHeaderAction,
  DashboardNavItem,
} from "@/components/dashboard/DashboardShell"
import { HeaderSearchBar } from "@/components/dashboard/header/HeaderSearchBar"
import { HeaderThemeMenu } from "@/components/dashboard/header/HeaderThemeMenu"
import { HeaderUserMenu } from "@/components/dashboard/header/HeaderUserMenu"
import styles from "@/components/dashboard/header/DashboardHeader.module.css"

type BreadcrumbItem = {
  label: string
  href?: string
}

function joinClasses(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ")
}

function getActionToneClass(
  tone: DashboardHeaderAction["tone"] | undefined,
) {
  switch (tone) {
    case "secondary":
      return styles.actionSecondary
    case "ghost":
      return styles.actionGhost
    case "danger":
      return styles.actionDanger
    default:
      return styles.actionPrimary
  }
}

export function DashboardHeader({
  breadcrumbs,
  title,
  description,
  actions,
  utility,
  theme,
  onThemeChange,
  notificationsItem,
  chatItem,
  user,
  homeHref,
  product,
  onMenuOpen,
  onSearchOpen,
  onLogout,
}: {
  breadcrumbs: BreadcrumbItem[]
  title: string
  description?: string
  actions: DashboardHeaderAction[]
  utility?: React.ReactNode
  theme: DashboardThemeKey
  onThemeChange: (theme: DashboardThemeKey) => void
  notificationsItem?: DashboardNavItem | null
  chatItem?: DashboardNavItem | null
  user?: {
    initials: string
    name?: string | null
    subtitle?: string | null
  } | null
  homeHref: string
  product: string
  onMenuOpen: () => void
  onSearchOpen: () => void
  onLogout?: () => Promise<void> | void
}) {
  const name = user?.name ?? "Workspace"
  const subtitle = user?.subtitle ?? product
  const initials = user?.initials ?? "TI"

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.primaryRow}>
          <div className={styles.contextArea}>
            <button
              type="button"
              className={styles.menuButton}
              onClick={onMenuOpen}
              aria-label="Open navigation"
            >
              <MenuIcon width={16} height={16} />
            </button>

            <div className={styles.contextText}>
              <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
                {breadcrumbs.map((item, index) => (
                  <span key={`${item.label}-${index}`} className={styles.breadcrumbItem}>
                    {item.href ? (
                      <Link href={item.href} className={styles.breadcrumbLink}>
                        {item.label}
                      </Link>
                    ) : (
                      <span className={styles.breadcrumbCurrent}>{item.label}</span>
                    )}
                    {index < breadcrumbs.length - 1 ? (
                      <span className={styles.separator}>/</span>
                    ) : null}
                  </span>
                ))}
              </nav>

              <div className={styles.titleRow}>
                <h1 className={styles.title}>{title}</h1>
                {description ? <p className={styles.description}>{description}</p> : null}
              </div>
            </div>
          </div>

          <div className={styles.searchArea}>
            <HeaderSearchBar onOpen={onSearchOpen} />
          </div>

          <div className={styles.utilityArea}>
            <HeaderSearchBar
              mode="compact"
              className={styles.mobileSearch}
              onOpen={onSearchOpen}
            />

            <HeaderThemeMenu theme={theme} onChange={onThemeChange} />
            {utility ? <div className={styles.statusSlot}>{utility}</div> : null}
            {notificationsItem ? (
              <UtilityLink item={notificationsItem} icon={NotificationsIcon} />
            ) : null}
            {chatItem ? <UtilityLink item={chatItem} icon={MessagesIcon} /> : null}

            <HeaderUserMenu
              initials={initials}
              name={name}
              subtitle={subtitle}
              homeHref={homeHref}
              onLogout={onLogout}
            />
          </div>
        </div>

        {actions.length ? (
          <div className={styles.actionRow}>
            {actions.map((action) => (
              <HeaderActionButton key={action.label} action={action} />
            ))}
          </div>
        ) : null}
      </div>
    </header>
  )
}

function HeaderActionButton({ action }: { action: DashboardHeaderAction }) {
  const Icon = action.icon
  const className = joinClasses(
    styles.actionButton,
    getActionToneClass(action.tone),
  )
  const content = (
    <>
      {Icon ? <Icon width={16} height={16} /> : null}
      <span>{action.label}</span>
    </>
  )

  if (action.href) {
    return (
      <Link href={action.href} className={className}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" className={className} onClick={action.onClick}>
      {content}
    </button>
  )
}

function UtilityLink({
  item,
  icon: Icon,
}: {
  item: DashboardNavItem
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}) {
  return (
    <Link
      href={item.href}
      className={styles.utilityLink}
      aria-label={item.label}
      title={item.label}
    >
      <Icon width={16} height={16} />
      {item.badge ? <span className={styles.utilityBadge}>{item.badge}</span> : null}
    </Link>
  )
}
