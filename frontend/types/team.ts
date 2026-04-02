export type TeamCategory = "CORE" | "TRUSTEE" | "INFLUENCERS"

export type TeamMember = {
  id: string
  name: string
  designation: string
  category: TeamCategory
  bio?: string | null
  photoUrl?: string | null
  instagramUrl?: string | null
  linkedInUrl?: string | null
  websiteUrl?: string | null
  email?: string | null
}

export type AdminTeamMember = TeamMember & {
  isActive: boolean
  isVisible: boolean
  sortOrder: number
}

export type TeamMemberMutationPayload = {
  id?: string
  name: string
  designation: string
  category: TeamCategory
  bio?: string
  photoUrl?: string
  instagramUrl?: string
  linkedInUrl?: string
  websiteUrl?: string
  email?: string
  isActive?: boolean
  isVisible?: boolean
  sortOrder?: number
}
