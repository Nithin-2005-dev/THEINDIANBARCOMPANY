"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  getDashboardThemeStyle,
  resolveDashboardThemeKey,
  type DashboardThemeKey,
} from "@/components/dashboard/dashboard-theme"
import {
  ArrowUpRightIcon,
  ChevronRightIcon,
  HomeIcon,
  LogoutIcon,
  SearchIcon,
  SidebarCollapseIcon,
  SparklesIcon,
} from "@/components/dashboard/icons"
import { DashboardHeader } from "@/components/dashboard/header/DashboardHeader"
import { themeStyles, type ThemeName } from "@/lib/theme"
import styles from "@/components/dashboard/DashboardShell.module.css"

export type DashboardNavItem = {
  href: string
  label: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  badge?: string | number
  matchPrefixes?: string[]
}

export type DashboardNavSection = {
  label: string
  items: DashboardNavItem[]
}

export type DashboardHeaderAction = {
  label: string
  href?: string
  onClick?: () => void
  tone?: "primary" | "secondary" | "ghost" | "danger"
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

export type DashboardHeaderContext = {
  title: string
  description?: string
  actions?: DashboardHeaderAction[]
  hideHeader?: boolean
}

type DashboardShellProps = {
  role: "client" | "staff" | "admin" | "vendor"
  brand: string
  product: string
  sections: DashboardNavSection[]
  user?: {
    name?: string | null
    subtitle?: string | null
  } | null
  utility?: React.ReactNode
  headerContext?: DashboardHeaderContext
  onLogout?: () => Promise<void> | void
  children: React.ReactNode
}

type CommandEntry = {
  id: string
  label: string
  hint: string
  group: string
  href?: string
  onSelect?: () => void
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  badge?: string | number
}

const sidebarStorageKey = "dashboard-sidebar-collapsed"
const dashboardThemeStorageKey = "dashboard-theme"

function joinClasses(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ")
}

function isItemActive(pathname: string, role: DashboardShellProps["role"], item: DashboardNavItem) {
  if (item.matchPrefixes?.some((prefix) => pathname.startsWith(prefix))) {
    return true
  }

  if (item.href === `/${role}` || item.href === "/dashboard") {
    return pathname === item.href
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

function getHomeHref() {
  return "/"
}

function getInitials(value?: string | null) {
  if (!value) return "TI"
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

function getTopRoutes(sections: DashboardNavSection[]) {
  const items = sections.flatMap((section) => section.items)
  return {
    notifications: items.find((item) => item.href.includes("/notifications")) ?? null,
    chat: items.find((item) => item.href.includes("/chat")) ?? null,
  }
}

function getRoleWorkspaceLabel(role: DashboardShellProps["role"]) {
  switch (role) {
    case "admin":
      return "Admin Command"
    case "staff":
      return "Staff Workspace"
    case "vendor":
      return "Vendor Portal"
    default:
      return "Client Portal"
  }
}

function getTooltipLabel(label: string, badge?: string | number) {
  if (badge === undefined || badge === null || badge === "") {
    return label
  }

  return `${label} (${badge})`
}

function resolveGlobalThemeName(theme: DashboardThemeKey): ThemeName {
  switch (theme) {
    case "martini":
      return "martini"
    case "cosmo":
      return "cosmo"
    case "negroni":
      return "negroni"
    case "bloody-mary":
      return "bm"
    default:
      return "tib"
  }
}

export function DashboardShell({
  role,
  brand,
  product,
  sections,
  user,
  utility,
  headerContext,
  onLogout,
  children,
}: DashboardShellProps) {
  const pathname = usePathname()
  const commandInputRef = useRef<HTMLInputElement | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState("")
  const [selectedTheme, setSelectedTheme] = useState<DashboardThemeKey>(() => {
    if (typeof window === "undefined") return "tib"

    const storedTheme = window.localStorage.getItem(dashboardThemeStorageKey)
    return storedTheme ? resolveDashboardThemeKey(storedTheme) : "tib"
  })
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false
    return window.localStorage.getItem(sidebarStorageKey) === "true"
  })

  useEffect(() => {
    window.localStorage.setItem(sidebarStorageKey, String(collapsed))
  }, [collapsed])

  useEffect(() => {
    window.localStorage.setItem(dashboardThemeStorageKey, selectedTheme)
  }, [selectedTheme])

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false)
    }

    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobileOpen || commandOpen ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [commandOpen, mobileOpen])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setCommandOpen(true)
      }

      if (event.key === "Escape") {
        setCommandOpen(false)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (!commandOpen) return
    const timerId = window.setTimeout(() => commandInputRef.current?.focus(), 0)
    return () => window.clearTimeout(timerId)
  }, [commandOpen])

  const homeHref = getHomeHref()
  const allItems = useMemo(() => sections.flatMap((section) => section.items), [sections])
  const activeItem = allItems.find((item) => isItemActive(pathname, role, item)) ?? null
  const title = headerContext?.title ?? activeItem?.label ?? (role === "client" ? "Overview" : product)
  const description = headerContext?.description
  const headerActions = useMemo(() => headerContext?.actions ?? [], [headerContext?.actions])
  const hideHeader = headerContext?.hideHeader ?? false
  const topRoutes = useMemo(() => getTopRoutes(sections), [sections])
  const currentWorkspaceLabel = getRoleWorkspaceLabel(role)
  const activeThemeStyle = useMemo(
    () => getDashboardThemeStyle(selectedTheme),
    [selectedTheme],
  )
  const globalThemeStyle = useMemo(
    () => themeStyles[resolveGlobalThemeName(selectedTheme)],
    [selectedTheme],
  )
  const shellThemeStyle = useMemo(
    () => ({ ...globalThemeStyle, ...activeThemeStyle }),
    [activeThemeStyle, globalThemeStyle],
  )

  useEffect(() => {
    if (typeof document === "undefined") {
      return
    }

    const root = document.documentElement
    const themeEntries = Object.entries(shellThemeStyle).filter(
      ([property, value]) => property.startsWith("--") && typeof value === "string",
    ) as Array<[string, string]>
    const previousThemeEntries = themeEntries.map(
      ([property]) => [property, root.style.getPropertyValue(property)] as const,
    )
    const previousTheme = root.dataset.dashboardTheme

    for (const [property, value] of themeEntries) {
      root.style.setProperty(property, value)
    }

    root.dataset.dashboardTheme = selectedTheme

    return () => {
      for (const [property, previousValue] of previousThemeEntries) {
        if (previousValue) {
          root.style.setProperty(property, previousValue)
        } else {
          root.style.removeProperty(property)
        }
      }

      if (previousTheme) {
        root.dataset.dashboardTheme = previousTheme
      } else {
        delete root.dataset.dashboardTheme
      }
    }
  }, [selectedTheme, shellThemeStyle])

  const breadcrumbs = useMemo(() => {
    const items: Array<{ label: string; href?: string }> = [{ label: product, href: homeHref }]
    if (activeItem && activeItem.href !== homeHref) items.push({ label: activeItem.label, href: activeItem.href })
    if (title !== activeItem?.label && title !== product) items.push({ label: title })
    return items
  }, [activeItem, homeHref, product, title])

  const commandEntries = useMemo<CommandEntry[]>(() => {
    const navigationEntries = sections.flatMap((section) =>
      section.items.map((item) => ({
        id: `nav:${item.href}`,
        label: item.label,
        hint: section.label,
        group: "Navigation",
        href: item.href,
        icon: item.icon,
        badge: item.badge,
      })),
    )

    const actionEntries = headerActions.map((action, index) => ({
      id: `action:${index}:${action.label}`,
      label: action.label,
      hint: title,
      group: "Quick Actions",
      href: action.href,
      onSelect: action.onClick,
      icon: action.icon ?? SparklesIcon,
    }))

    return [...navigationEntries, ...actionEntries]
  }, [headerActions, sections, title])

  const filteredCommandEntries = useMemo(() => {
    const query = commandQuery.trim().toLowerCase()
    if (!query) return commandEntries
    return commandEntries.filter((entry) =>
      [entry.label, entry.hint, entry.group].join(" ").toLowerCase().includes(query),
    )
  }, [commandEntries, commandQuery])

  const groupedCommandEntries = useMemo(() => {
    return filteredCommandEntries.reduce<Record<string, CommandEntry[]>>((groups, entry) => {
      const group = groups[entry.group] ?? []
      group.push(entry)
      groups[entry.group] = group
      return groups
    }, {})
  }, [filteredCommandEntries])

  return (
    <div
      className={styles.root}
      style={shellThemeStyle}
      data-theme={selectedTheme}
    >
      <div className={styles.layout}>
        <div className={joinClasses(styles.backdrop, mobileOpen && styles.backdropOpen)} onClick={() => setMobileOpen(false)} />
        <div className={joinClasses(styles.rail, collapsed && styles.railCollapsed)} aria-hidden="true" />

        <aside className={joinClasses(styles.sidebar, mobileOpen && styles.sidebarOpen, collapsed && styles.sidebarCollapsed)}>
          <div className={joinClasses(styles.card, styles.brand)}>
            <div className={styles.mark}>{getInitials(brand)}</div>
            {!collapsed ? (
              <div className={styles.brandMeta}>
                <div className={styles.brandTitle}>{brand}</div>
                <div className={styles.brandCopy}>{currentWorkspaceLabel}</div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className={joinClasses(styles.searchTrigger, collapsed && styles.searchCollapsed)}
            aria-label="Open workspace search"
            data-label={collapsed ? "Search" : undefined}
          >
            <SearchIcon width={16} height={16} />
            {!collapsed ? <><span>Search pages and actions</span><span className={styles.kbd}>Cmd K</span></> : null}
          </button>

          <nav className={styles.nav}>
            {sections.map((section) => (
              <div key={section.label}>
                {!collapsed ? <p className={styles.sectionLabel}>{section.label}</p> : null}
                <div className={styles.workspaceList}>
                  {section.items.map((item) => {
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={joinClasses(styles.navItem, isItemActive(pathname, role, item) && styles.navActive, collapsed && styles.navCollapsed)}
                        onClick={() => setMobileOpen(false)}
                        title={collapsed ? item.label : undefined}
                        data-label={collapsed ? getTooltipLabel(item.label, item.badge) : undefined}
                      >
                        <Icon width={18} height={18} />
                        {!collapsed ? <><span className={styles.navText}>{item.label}</span>{item.badge ? <span className={styles.badge}>{item.badge}</span> : null}</> : item.badge ? <span className={styles.iconBadge}>{item.badge}</span> : null}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className={styles.footer}>
            {user ? (
              <div
                className={joinClasses(styles.card, styles.profile, collapsed && styles.collapsedOnly)}
                data-label={collapsed ? user.name ?? "Workspace user" : undefined}
              >
                <div className={styles.avatar}>{getInitials(user.name ?? "User")}</div>
                {!collapsed ? (
                  <div className={styles.profileMeta}>
                    <div className={styles.profileName}>{user.name ?? "Workspace User"}</div>
                    <div className={styles.profileSub}>{user.subtitle ?? product}</div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className={styles.controls}>
              <button
                type="button"
                className={joinClasses(styles.iconButton, styles.sidebarToggleButton)}
                onClick={() => setCollapsed((current) => !current)}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                data-label={collapsed ? "Expand sidebar" : undefined}
              >
                {collapsed ? (
                  <ChevronRightIcon width={16} height={16} />
                ) : (
                  <SidebarCollapseIcon width={16} height={16} />
                )}
              </button>
              {!collapsed ? <Link href={homeHref} className={styles.button}><HomeIcon width={16} height={16} /><span>Home</span></Link> : null}
              <button
                type="button"
                onClick={() => void onLogout?.()}
                className={joinClasses(
                  collapsed ? styles.iconButton : styles.button,
                  styles.logoutButton,
                )}
                aria-label="Log out"
                data-label={collapsed ? "Log out" : undefined}
              >
                <LogoutIcon width={16} height={16} />
                {!collapsed ? <span>Log out</span> : null}
              </button>
            </div>
          </div>
        </aside>

        <div className={styles.main}>
          {!hideHeader ? (
            <DashboardHeader
              breadcrumbs={breadcrumbs}
              title={title}
              description={description}
              actions={headerActions}
              utility={utility}
              theme={selectedTheme}
              onThemeChange={setSelectedTheme}
              notificationsItem={topRoutes.notifications}
              chatItem={topRoutes.chat}
              user={{
                initials: getInitials(user?.name ?? "U"),
                name: user?.name,
                subtitle: user?.subtitle,
              }}
              homeHref={homeHref}
              product={product}
              onMenuOpen={() => setMobileOpen(true)}
              onSearchOpen={() => setCommandOpen(true)}
              onLogout={onLogout}
            />
          ) : null}

          <main className={styles.content}>{children}</main>
        </div>
      </div>

      {commandOpen ? (
        <div className={styles.commandOverlay} onMouseDown={(event) => event.target === event.currentTarget && setCommandOpen(false)}>
          <div className={styles.commandPanel}>
            <div className={styles.commandInputRow}>
              <SearchIcon width={16} height={16} />
              <input ref={commandInputRef} value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} placeholder="Search pages and actions" className={styles.commandInput} />
              <button type="button" className={styles.kbd} onClick={() => setCommandOpen(false)}>Esc</button>
            </div>

            <div className={styles.commandResults}>
              {Object.entries(groupedCommandEntries).length ? Object.entries(groupedCommandEntries).map(([group, entries]) => (
                <div key={group}>
                  <p className={styles.sectionLabel}>{group}</p>
                  <div className={styles.workspaceList}>
                    {entries.map((entry) => {
                      const Icon = entry.icon
                      const tail = entry.badge ? <span className={styles.badge}>{entry.badge}</span> : entry.href ? <ArrowUpRightIcon width={16} height={16} /> : <SparklesIcon width={16} height={16} />
                      const content = (
                        <>
                          <div className={styles.itemIcon}><Icon width={16} height={16} /></div>
                          <div className={styles.commandMeta}>
                            <p className={styles.resultTitle}>{entry.label}</p>
                            <p className={styles.resultHint}>{entry.hint}</p>
                          </div>
                          {tail}
                        </>
                      )

                      if (entry.href) {
                        return <Link key={entry.id} href={entry.href} className={styles.result} onClick={() => { entry.onSelect?.(); setCommandOpen(false) }}>{content}</Link>
                      }

                      return <button key={entry.id} type="button" className={styles.result} onClick={() => { entry.onSelect?.(); setCommandOpen(false) }}>{content}</button>
                    })}
                  </div>
                </div>
              )) : (
                <div className={styles.empty}>
                  <p className={styles.sectionLabel}>Command Search</p>
                  <h2 className={styles.emptyTitle}>No matching results</h2>
                  <p className={styles.emptyCopy}>Try a page name like bookings, notifications, or payments.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
