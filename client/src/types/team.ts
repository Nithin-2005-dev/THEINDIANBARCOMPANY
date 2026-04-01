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
  photoPublicId?: string | null
  isActive: boolean
  isVisible: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type TeamImageUploadSignature = {
  apiKey: string
  cloudName: string
  folder: string
  publicId: string
  signature: string
  timestamp: number
  uploadUrl: string
}

export type TeamMemberMutationPayload = {
  name: string
  designation: string
  category: TeamCategory
  bio?: string
  photoUrl?: string
  photoPublicId?: string
  instagramUrl?: string
  linkedInUrl?: string
  websiteUrl?: string
  email?: string
  isActive?: boolean
  isVisible?: boolean
  sortOrder?: number
  removePhoto?: boolean
}
