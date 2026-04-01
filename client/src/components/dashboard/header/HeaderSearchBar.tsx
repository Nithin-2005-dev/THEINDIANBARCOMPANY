"use client"

import { SearchIcon } from "@/components/dashboard/icons"
import styles from "@/components/dashboard/header/HeaderSearchBar.module.css"

function joinClasses(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ")
}

export function HeaderSearchBar({
  mode = "full",
  className,
  onOpen,
}: {
  mode?: "full" | "compact"
  className?: string
  onOpen: () => void
}) {
  if (mode === "compact") {
    return (
      <button
        type="button"
        className={joinClasses(styles.compactButton, className)}
        onClick={onOpen}
        aria-label="Open search"
      >
        <SearchIcon width={16} height={16} />
      </button>
    )
  }

  return (
    <form
      role="search"
      className={joinClasses(styles.form, className)}
      onSubmit={(event) => {
        event.preventDefault()
        onOpen()
      }}
    >
      <SearchIcon className={styles.icon} />
      <label className={styles.inputWrap}>
        <span className={styles.visuallyHidden}>Search workspace</span>
        <input
          type="search"
          readOnly
          inputMode="search"
          placeholder="Search pages, bookings, and actions"
          className={styles.input}
          onFocus={onOpen}
          onClick={onOpen}
          aria-label="Search pages, bookings, and actions"
        />
      </label>
      <span className={styles.shortcut}>Cmd K</span>
    </form>
  )
}
