import React from "react"

type Props = {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export default function Button({
  children,
  className = "",
  onClick,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        px-6 py-3 rounded-xl font-semibold
        bg-(--primary)
        text-white
        hover:bg-(--accent)
        transition
        ${className}
      `}
    >
      {children}
    </button>
  )
}