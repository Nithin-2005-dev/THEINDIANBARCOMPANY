import Link from "next/link"
import { SearchIcon } from "@/components/dashboard/icons"
import Badge from "@/components/ui/Badge/Badge"
import Button, { getButtonClassName } from "@/components/ui/Button/Button"
import Card from "@/components/ui/Card/Card"
import UiEmptyState from "@/components/ui/EmptyState/EmptyState"
import Input from "@/components/ui/Input/Input"
import Skeleton from "@/components/ui/Skeleton/Skeleton"
import styles from "@/components/dashboard/DashboardPrimitives.module.css"

type CommonProps = {
  className?: string
  children: React.ReactNode
}

type Action = {
  label: string
  href?: string
  onClick?: () => void
}

type Tab = {
  id: string
  label: string
  badge?: string | number
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

function joinClasses(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ")
}

export function DashboardPage({ className, children }: CommonProps) {
  return <div className={joinClasses(styles.page, className)}>{children}</div>
}

export function PageHero({
  eyebrow,
  title,
  description,
  action,
  secondaryAction,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: Action
  secondaryAction?: Action
}) {
  return (
    <Card
      as="section"
      eyebrow={eyebrow}
      title={title}
      titleAs="h1"
      description={description}
      className={joinClasses(styles.surface, styles.hero)}
      headerAction={
        action || secondaryAction ? (
          <div className={styles.heroActions}>
            {secondaryAction ? <ActionButton action={secondaryAction} tone="secondary" /> : null}
            {action ? <ActionButton action={action} tone="primary" /> : null}
          </div>
        ) : null
      }
    />
  )
}

export function Surface({
  className,
  title,
  description,
  headerAction,
  children,
}: CommonProps & {
  title?: string
  description?: string
  headerAction?: React.ReactNode
}) {
  return (
    <Card
      as="section"
      title={title}
      titleAs="h2"
      description={description}
      headerAction={headerAction}
      className={joinClasses(styles.surface, className)}
    >
      {children}
    </Card>
  )
}

export function MetricCard({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string
  value: string | number
  hint?: string
  emphasis?: string
}) {
  return (
    <Card as="div" tone="subtle" className={styles.metricCard}>
      <div className={styles.metricHeader}>
        <p className={styles.metricLabel}>{label}</p>
        <span className={styles.metricDot} />
      </div>
      <div className={styles.metricContent}>
        <p className={styles.metricValue}>{value}</p>
        {emphasis ? <span className={styles.pill}>{emphasis}</span> : null}
      </div>
      {hint ? <p className={styles.metricHint}>{hint}</p> : null}
    </Card>
  )
}

export function WorkspaceTabs({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: Tab[]
  activeTab: string
  onChange: (tabId: string) => void
}) {
  return (
    <div className={styles.tabs}>
      {tabs.map((tab) => {
        const Icon = tab.icon
        const active = tab.id === activeTab

        return (
          <button
            key={tab.id}
            type="button"
            className={joinClasses(styles.tab, active && styles.tabActive)}
            onClick={() => onChange(tab.id)}
          >
            {Icon ? <Icon width={16} height={16} aria-hidden="true" /> : null}
            <span>{tab.label}</span>
            {tab.badge ? <span className={styles.tabBadge}>{tab.badge}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

export function DashboardButton({
  tone = "primary",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary" | "ghost" | "danger"
}) {
  return (
    <Button variant={tone} className={className} {...props}>
      {children}
    </Button>
  )
}

export function DashboardSearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  ariaLabel?: string
  className?: string
}) {
  return (
    <Input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel ?? placeholder}
      className={joinClasses(styles.searchField, className)}
      inputClassName={styles.searchInput}
      leadingAdornment={<SearchIcon className={styles.searchIcon} />}
    />
  )
}

export function DataPill({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <Badge variant="accent" size="sm" className={className}>
      {children}
    </Badge>
  )
}

export function StatusIndicator({
  className,
  tone = "neutral",
  children,
}: {
  className?: string
  tone?: "neutral" | "success" | "warning" | "danger"
  children: React.ReactNode
}) {
  return (
    <span
      className={joinClasses(
        styles.statusIndicator,
        tone === "success"
          ? styles.statusIndicatorSuccess
          : tone === "warning"
            ? styles.statusIndicatorWarning
            : tone === "danger"
              ? styles.statusIndicatorDanger
              : null,
        className,
      )}
    >
      {children}
    </span>
  )
}

export function EmptyState({
  title,
  description,
  action,
  align,
}: {
  title: string
  description: string
  action?: Action
  align?: "left" | "center"
}) {
  return (
    <UiEmptyState
      title={title}
      description={description}
      eyebrow="Next best step"
      align={align}
      action={action ? <ActionButton action={action} tone="primary" /> : null}
    />
  )
}

export function InlineNotice({
  tone = "default",
  title,
  description,
  className,
}: {
  tone?: "default" | "warning" | "error" | "success"
  title: string
  description?: string
  className?: string
}) {
  return (
    <div
      className={joinClasses(
        styles.notice,
        tone === "warning"
          ? styles.noticeWarning
          : tone === "error"
            ? styles.noticeError
            : tone === "success"
              ? styles.noticeSuccess
              : styles.noticeDefault,
        className,
      )}
    >
      <p className={styles.noticeTitle}>{title}</p>
      {description ? <p className={styles.noticeDescription}>{description}</p> : null}
    </div>
  )
}

export function ErrorState({
  title,
  description,
  action,
  align,
}: {
  title: string
  description: string
  action?: Action
  align?: "left" | "center"
}) {
  return (
    <UiEmptyState
      title={title}
      description={description}
      eyebrow="Needs attention"
      tone="danger"
      align={align}
      action={action ? <ActionButton action={action} tone="secondary" /> : null}
    />
  )
}

export function SkeletonPageHero({ className }: { className?: string }) {
  return (
    <Card as="div" className={joinClasses(styles.surface, styles.hero, className)}>
      <div className={styles.heroHeader}>
        <div className={styles.heroBody}>
          <Skeleton className={joinClasses(styles.skeletonLine, styles.skeletonEyebrow)} />
          <div className={styles.skeletonHeroTitleStack}>
            <Skeleton className={joinClasses(styles.skeletonValue, styles.skeletonHeroTitlePrimary)} />
            <Skeleton className={joinClasses(styles.skeletonValue, styles.skeletonHeroTitleSecondary)} />
          </div>
          <div className={styles.skeletonHeroCopyStack}>
            <Skeleton className={joinClasses(styles.skeletonLine, styles.skeletonHeroDescription)} />
            <Skeleton className={joinClasses(styles.skeletonLine, styles.skeletonHeroDescriptionShort)} />
          </div>
        </div>
        <div className={styles.heroActions}>
          <Skeleton className={joinClasses(styles.skeletonLine, styles.skeletonButton)} />
          <Skeleton className={joinClasses(styles.skeletonLine, styles.skeletonButtonPrimary)} />
        </div>
      </div>
    </Card>
  )
}

export function SkeletonMetricGrid({ count = 4 }: { count?: number }) {
  return (
    <div className={styles.metricGrid}>
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} as="div" tone="subtle" className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <Skeleton className={joinClasses(styles.skeletonLine, styles.skeletonMetricLabel)} />
            <Skeleton circle className={styles.skeletonMetricDot} />
          </div>
          <div className={styles.metricContent}>
            <Skeleton className={joinClasses(styles.skeletonValue, styles.skeletonMetricValue)} />
            {index % 2 === 1 ? (
              <Skeleton className={joinClasses(styles.skeletonLine, styles.skeletonMetricPill)} />
            ) : null}
          </div>
          <div className={styles.skeletonMetricHintStack}>
            <Skeleton className={joinClasses(styles.skeletonLine, styles.skeletonMetricHint)} />
            {index % 3 === 0 ? (
              <Skeleton className={joinClasses(styles.skeletonLine, styles.skeletonMetricHintShort)} />
            ) : null}
          </div>
        </Card>
      ))}
    </div>
  )
}

export function SkeletonSurface({
  className,
  itemCount = 3,
  showAction = true,
}: {
  className?: string
  itemCount?: number
  showAction?: boolean
}) {
  return (
    <Card as="div" className={joinClasses(styles.surface, className)}>
      <div className={styles.surfaceHeader}>
        <div className={styles.surfaceBody}>
          <Skeleton className={joinClasses(styles.skeletonLine, styles.skeletonTitle)} />
          <div className={styles.skeletonSurfaceCopy}>
            <Skeleton className={joinClasses(styles.skeletonLine, styles.skeletonBody)} />
            <Skeleton className={joinClasses(styles.skeletonLine, styles.skeletonBodyShort)} />
          </div>
        </div>
        {showAction ? (
          <div className={styles.surfaceAction}>
            <Skeleton className={joinClasses(styles.skeletonLine, styles.skeletonSurfaceAction)} />
          </div>
        ) : null}
      </div>
      <div className={styles.skeletonStack}>
        {Array.from({ length: itemCount }).map((_, index) => (
          <Card key={index} as="div" tone="subtle" className={styles.skeletonItemCard}>
            <div className={styles.skeletonItemHeader}>
              <div className={styles.skeletonItemCopy}>
                <Skeleton className={joinClasses(styles.skeletonLine, styles.skeletonItemTitle)} />
                <Skeleton className={joinClasses(styles.skeletonLine, styles.skeletonItemSubtitle)} />
              </div>
              <Skeleton className={joinClasses(styles.skeletonLine, styles.skeletonItemBadge)} />
            </div>
            <div className={styles.skeletonItemMeta}>
              <Skeleton className={joinClasses(styles.skeletonLine, styles.skeletonItemMetaPrimary)} />
              {index % 2 === 0 ? (
                <Skeleton className={joinClasses(styles.skeletonLine, styles.skeletonItemMetaSecondary)} />
              ) : null}
            </div>
          </Card>
        ))}
      </div>
    </Card>
  )
}

export function DashboardScreenLoader({ metricCount = 4 }: { metricCount?: number }) {
  return (
    <div className={styles.screenLoader}>
      <div className={styles.screenLoaderPanel}>
        <DashboardPage>
          <SkeletonPageHero />
          <SkeletonMetricGrid count={metricCount} />
          <div className={styles.loaderSplit}>
            <SkeletonSurface />
            <SkeletonSurface />
          </div>
        </DashboardPage>
      </div>
    </div>
  )
}

function ActionButton({
  action,
  tone,
}: {
  action: Action
  tone: "primary" | "secondary" | "ghost" | "danger"
}) {
  if (action.href) {
    return (
      <Link href={action.href} className={getButtonClassName({ variant: tone })}>
        {action.label}
      </Link>
    )
  }

  return (
    <Button type="button" onClick={action.onClick} variant={tone}>
      {action.label}
    </Button>
  )
}
