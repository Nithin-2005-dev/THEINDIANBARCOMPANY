import type { ReactNode } from "react"
import UiEmptyState from "@/components/ui/EmptyState/EmptyState"

type EmptyStateProps = {
  action?: ReactNode
  title: string
  description: string
}

export default function EmptyState({ action, title, description }: EmptyStateProps) {
  return (
    <UiEmptyState
      title={title}
      description={description}
      eyebrow="Nothing here yet"
      align="center"
      action={action}
    />
  )
}
