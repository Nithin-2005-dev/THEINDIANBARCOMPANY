import type { CSSProperties, HTMLAttributes } from "react"
import styles from "./Skeleton.module.css"

type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  circle?: boolean
  height?: string
  width?: string
}

function joinClasses(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ")
}

export default function Skeleton({
  circle = false,
  className,
  height,
  style,
  width,
  ...props
}: SkeletonProps) {
  const customStyle = {
    ...(style ?? {}),
    ...(width ? { ["--skeleton-width" as const]: width } : {}),
    ...(height ? { ["--skeleton-height" as const]: height } : {}),
  } satisfies CSSProperties

  return (
    <div
      className={joinClasses(styles.root, circle && styles.circle, className)}
      style={customStyle}
      aria-hidden="true"
      {...props}
    />
  )
}
