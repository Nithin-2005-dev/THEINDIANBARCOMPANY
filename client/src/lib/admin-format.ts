export function formatDate(value?: string | null) {
  if (!value) return "N/A"
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export function formatDateOnly(value?: string | null) {
  if (!value) return "N/A"
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
  }).format(new Date(value))
}

export function formatCurrency(value?: number | null) {
  if (value === undefined || value === null) return "N/A"
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatRelativeDate(value?: string | null) {
  if (!value) return "N/A"

  const now = Date.now()
  const date = new Date(value).getTime()
  const diffHours = Math.round((date - now) / (1000 * 60 * 60))

  if (Math.abs(diffHours) < 24) {
    if (diffHours >= 0) return `in ${diffHours}h`
    return `${Math.abs(diffHours)}h ago`
  }

  const diffDays = Math.round(diffHours / 24)
  if (diffDays >= 0) return `in ${diffDays}d`
  return `${Math.abs(diffDays)}d ago`
}
