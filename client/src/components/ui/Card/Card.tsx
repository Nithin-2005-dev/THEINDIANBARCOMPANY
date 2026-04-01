import { createElement } from "react"
import type { ElementType, HTMLAttributes, ReactNode } from "react"
import styles from "./Card.module.css"

type CardTone = "default" | "subtle" | "danger"

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType
  children?: ReactNode
  className?: string
  contentClassName?: string
  description?: string
  eyebrow?: string
  headerAction?: ReactNode
  title?: string
  titleAs?: ElementType
  tone?: CardTone
}

function joinClasses(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ")
}

export default function Card({
  as: Component = "section",
  children,
  className,
  contentClassName,
  description,
  eyebrow,
  headerAction,
  title,
  titleAs: TitleTag = "h3",
  tone = "default",
  ...props
}: CardProps) {
  const hasHeader = Boolean(title || description || eyebrow || headerAction)
  const titleNode = title ? createElement(TitleTag, { className: styles.title }, title) : null

  return createElement(
    Component,
    {
      className: joinClasses(
        styles.root,
        tone === "subtle" && styles.subtle,
        tone === "danger" && styles.danger,
        className,
      ),
      ...props,
    },
    <>
      {hasHeader ? (
        <div className={styles.header}>
          <div className={styles.headerBody}>
            {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
            {titleNode}
            {description ? <p className={styles.description}>{description}</p> : null}
          </div>
          {headerAction ? <div className={styles.headerAction}>{headerAction}</div> : null}
        </div>
      ) : null}
      {children !== undefined && children !== null ? (
        <div
          className={joinClasses(
            hasHeader && styles.content,
            contentClassName,
          )}
        >
          {children}
        </div>
      ) : null}
    </>,
  )
}
