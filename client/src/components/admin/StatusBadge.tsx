import Badge from "@/components/ui/Badge/Badge"
import type { BadgeVariant } from "@/components/ui/Badge/Badge"

type StatusBadgeProps = {
  value: string
}

const accentStatuses = new Set([
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "NEGOTIATING",
  "DRAFT",
  "SENT",
  "PLANNING",
  "PREPARATION",
  "EXECUTION",
  "READY",
  "EVENT_DAY",
  "PRIMARY",
  "ADMIN",
  "SALES",
  "OPS",
  "CLIENT",
  "VENDOR",
  "RETRYING",
])

const successStatuses = new Set([
  "WON",
  "ACCEPTED",
  "SIGNED",
  "PAID",
  "COMPLETED",
  "ACTIVE",
  "DONE",
  "FINANCE",
])

const warningStatuses = new Set([
  "NEW",
  "PENDING",
  "BUSY",
  "IN_PROGRESS",
  "QUEUED",
  "PROCESSING",
])

const dangerStatuses = new Set([
  "LOST",
  "REJECTED",
  "FAILED",
  "CANCELLED",
  "BLOCKED",
])

function getToneClass(value: string): BadgeVariant {
  if (successStatuses.has(value)) return "success"
  if (warningStatuses.has(value)) return "warning"
  if (dangerStatuses.has(value)) return "danger"
  if (accentStatuses.has(value)) return "accent"
  return "neutral"
}

export default function StatusBadge({ value }: StatusBadgeProps) {
  return (
    <Badge variant={getToneClass(value)}>
      {value.replaceAll("_", " ")}
    </Badge>
  )
}
