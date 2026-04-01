export type LoginIdentifierKind = "phone" | "email" | "unknown"

export function detectLoginIdentifier(value: string): LoginIdentifierKind {
  const normalized = value.trim()

  if (/^\+?[1-9]\d{9,14}$/.test(normalized.replace(/\s+/g, ""))) {
    return "phone"
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.toLowerCase())) {
    return "email"
  }

  return "unknown"
}

export function normalizeLoginIdentifier(value: string) {
  const kind = detectLoginIdentifier(value)
  const trimmed = value.trim()

  if (kind === "phone") {
    return trimmed.replace(/\s+/g, "")
  }

  if (kind === "email") {
    return trimmed.toLowerCase()
  }

  return trimmed
}

export function describeLoginIdentifier(value: string) {
  const normalized = normalizeLoginIdentifier(value)
  const kind = detectLoginIdentifier(normalized)

  if (kind === "email") {
    return "email"
  }

  if (kind === "phone") {
    return "phone"
  }

  return "contact"
}
