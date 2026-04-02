import type { TeamCategory } from "@/types/team"

export const TEAM_CATEGORIES: TeamCategory[] = ["CORE", "TRUSTEE", "INFLUENCERS"]

export const TEAM_CATEGORY_LABELS: Record<TeamCategory, string> = {
  CORE: "Core",
  TRUSTEE: "Trustee",
  INFLUENCERS: "Influencers",
}

const TEAM_CATEGORY_ORDER: Record<TeamCategory, number> = {
  CORE: 0,
  TRUSTEE: 1,
  INFLUENCERS: 2,
}

export function getTeamCategoryLabel(category: TeamCategory) {
  return TEAM_CATEGORY_LABELS[category]
}

export function sortTeamMembers<T extends { category: TeamCategory; sortOrder?: number | null; name: string }>(
  members: T[],
) {
  return [...members].sort((left, right) => {
    const byCategory = TEAM_CATEGORY_ORDER[left.category] - TEAM_CATEGORY_ORDER[right.category]
    if (byCategory !== 0) return byCategory

    const byOrder = (left.sortOrder ?? 0) - (right.sortOrder ?? 0)
    if (byOrder !== 0) return byOrder

    return left.name.localeCompare(right.name)
  })
}

export function getTeamInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (!parts.length) return "TB"

  const first = parts[0]?.[0] ?? ""
  const second = parts[1]?.[0] ?? parts[0]?.[1] ?? ""

  return `${first}${second}`.trim().toUpperCase() || name.slice(0, 2).toUpperCase()
}
