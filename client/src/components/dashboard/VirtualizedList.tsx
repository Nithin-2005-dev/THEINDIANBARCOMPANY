"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import styles from "@/components/dashboard/VirtualizedList.module.css"

export function VirtualizedList<T>({
  items,
  itemHeight,
  height,
  overscan = 4,
  className,
  contentClassName,
  getKey,
  renderItem,
  empty,
  role,
  ariaLabel,
  followOutput = false,
}: {
  items: T[]
  itemHeight: number
  height: number
  overscan?: number
  className?: string
  contentClassName?: string
  getKey?: (item: T, index: number) => string | number
  renderItem: (item: T, index: number) => React.ReactNode
  empty?: React.ReactNode
  role?: React.AriaRole
  ariaLabel?: string
  followOutput?: boolean
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const scrollTopRef = useRef(0)
  const [scrollTop, setScrollTop] = useState(0)

  const range = useMemo(() => {
    const visibleCount = Math.max(1, Math.ceil(height / itemHeight))
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const end = Math.min(items.length, start + visibleCount + overscan * 2)

    return { start, end }
  }, [height, itemHeight, items.length, overscan, scrollTop])

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!followOutput || !containerRef.current) {
      return
    }

    const container = containerRef.current
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight

    if (distanceFromBottom <= itemHeight * 2) {
      container.scrollTop = container.scrollHeight
      scrollTopRef.current = container.scrollTop
      setScrollTop(container.scrollTop)
    }
  }, [followOutput, itemHeight, items.length])

  if (!items.length) {
    return empty ?? null
  }

  const topPadding = range.start * itemHeight
  const bottomPadding = Math.max(0, (items.length - range.end) * itemHeight)

  return (
    <div
      ref={containerRef}
      role={role}
      aria-label={ariaLabel}
      className={[styles.container, className].filter(Boolean).join(" ")}
      style={{
        height,
        contain: "layout paint size",
      }}
      onScroll={(event) => {
        scrollTopRef.current = event.currentTarget.scrollTop

        if (frameRef.current !== null) {
          return
        }

        frameRef.current = window.requestAnimationFrame(() => {
          frameRef.current = null
          setScrollTop(scrollTopRef.current)
        })
      }}
    >
      <div
        style={{ paddingTop: topPadding, paddingBottom: bottomPadding }}
        className={contentClassName}
      >
        {items.slice(range.start, range.end).map((item, index) => (
          <div
            key={getKey?.(item, range.start + index) ?? range.start + index}
            style={{ minHeight: itemHeight }}
          >
            {renderItem(item, range.start + index)}
          </div>
        ))}
      </div>
    </div>
  )
}
