import "server-only"

import type { ObjectId } from "mongodb"
import { TEAM_CATEGORIES, sortTeamMembers } from "@/lib/team"
import { getMongoDb } from "@/lib/mongodb"
import type { AdminTeamMember, TeamCategory, TeamMember, TeamMemberMutationPayload } from "@/types/team"

const DEFAULT_COLLECTION_NAME = "teamMembers"

type TeamMemberDocument = {
  _id?: ObjectId
  id?: string
  name?: string
  designation?: string
  category?: string
  bio?: string | null
  photoUrl?: string | null
  instagramUrl?: string | null
  linkedInUrl?: string | null
  websiteUrl?: string | null
  email?: string | null
  isActive?: boolean
  isVisible?: boolean
  sortOrder?: number | null
}

type StoredTeamMember = TeamMember & {
  isActive?: boolean
  isVisible?: boolean
  sortOrder?: number | null
}

function getTeamCollection(database: NonNullable<Awaited<ReturnType<typeof getMongoDb>>>) {
  return database.collection<TeamMemberDocument>(getTeamCollectionName())
}

function getTeamCollectionName() {
  return process.env.MONGODB_TEAM_COLLECTION?.trim() || DEFAULT_COLLECTION_NAME
}

function toTrimmedString(value: unknown) {
  if (typeof value !== "string") {
    return ""
  }

  return value.trim()
}

function toOptionalString(value: unknown) {
  const trimmed = toTrimmedString(value)
  return trimmed ? trimmed : null
}

function toCategory(value: unknown): TeamCategory | null {
  const normalized = toTrimmedString(value).toUpperCase() as TeamCategory

  return TEAM_CATEGORIES.includes(normalized) ? normalized : null
}

function normalizeTeamMember(document: TeamMemberDocument): StoredTeamMember | null {
  const name = toTrimmedString(document.name)
  const designation = toTrimmedString(document.designation)
  const category = toCategory(document.category)

  if (!name || !designation || !category) {
    return null
  }

  return {
    id: toTrimmedString(document.id) || document._id?.toString() || `${category}-${name}`,
    name,
    designation,
    category,
    bio: toOptionalString(document.bio),
    photoUrl: toOptionalString(document.photoUrl),
    instagramUrl: toOptionalString(document.instagramUrl),
    linkedInUrl: toOptionalString(document.linkedInUrl),
    websiteUrl: toOptionalString(document.websiteUrl),
    email: toOptionalString(document.email),
    isActive: typeof document.isActive === "boolean" ? document.isActive : true,
    isVisible: typeof document.isVisible === "boolean" ? document.isVisible : true,
    sortOrder: typeof document.sortOrder === "number" ? document.sortOrder : 0,
  }
}

function toPublicTeamMember(member: StoredTeamMember): TeamMember {
  return {
    id: member.id,
    name: member.name,
    designation: member.designation,
    category: member.category,
    bio: member.bio,
    photoUrl: member.photoUrl,
    instagramUrl: member.instagramUrl,
    linkedInUrl: member.linkedInUrl,
    websiteUrl: member.websiteUrl,
    email: member.email,
  }
}

function toAdminTeamMember(member: StoredTeamMember): AdminTeamMember {
  return {
    id: member.id,
    name: member.name,
    designation: member.designation,
    category: member.category,
    bio: member.bio,
    photoUrl: member.photoUrl,
    instagramUrl: member.instagramUrl,
    linkedInUrl: member.linkedInUrl,
    websiteUrl: member.websiteUrl,
    email: member.email,
    isActive: member.isActive !== false,
    isVisible: member.isVisible !== false,
    sortOrder: typeof member.sortOrder === "number" ? member.sortOrder : 0,
  }
}

function createTeamId(name: string, category: TeamCategory) {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return `${category.toLowerCase()}-${slug || "member"}`
}

function toOptionalInputString(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeMutationPayload(payload: TeamMemberMutationPayload) {
  const name = payload.name.trim()
  const designation = payload.designation.trim()
  const category = payload.category

  if (!name) {
    throw new Error("Name is required.")
  }

  if (!designation) {
    throw new Error("Designation is required.")
  }

  if (!TEAM_CATEGORIES.includes(category)) {
    throw new Error("Category is invalid.")
  }

  return {
    id: payload.id?.trim() || createTeamId(name, category),
    name,
    designation,
    category,
    bio: toOptionalInputString(payload.bio),
    photoUrl: toOptionalInputString(payload.photoUrl),
    instagramUrl: toOptionalInputString(payload.instagramUrl),
    linkedInUrl: toOptionalInputString(payload.linkedInUrl),
    websiteUrl: toOptionalInputString(payload.websiteUrl),
    email: toOptionalInputString(payload.email),
    isActive: payload.isActive ?? true,
    isVisible: payload.isVisible ?? true,
    sortOrder: Number.isFinite(payload.sortOrder) ? Number(payload.sortOrder) : 0,
  }
}

export async function getPublishedTeamMembers(): Promise<TeamMember[]> {
  const database = await getMongoDb()

  if (!database) {
    return []
  }

  const documents = await database
    .collection<TeamMemberDocument>(getTeamCollectionName())
    .find({})
    .toArray()

  const members = sortTeamMembers(
    documents
      .map(normalizeTeamMember)
      .filter((member): member is StoredTeamMember => Boolean(member))
      .filter((member) => member.isActive !== false && member.isVisible !== false),
  )

  return members.map(toPublicTeamMember)
}

export async function getAdminTeamMembers(): Promise<AdminTeamMember[]> {
  const database = await getMongoDb()

  if (!database) {
    return []
  }

  const documents = await getTeamCollection(database).find({}).toArray()

  const members = sortTeamMembers(
    documents
      .map(normalizeTeamMember)
      .filter((member): member is StoredTeamMember => Boolean(member)),
  )

  return members.map(toAdminTeamMember)
}

export async function saveTeamMember(payload: TeamMemberMutationPayload): Promise<AdminTeamMember> {
  const database = await getMongoDb()

  if (!database) {
    throw new Error("MongoDB is not configured.")
  }

  const collection = getTeamCollection(database)
  const normalized = normalizeMutationPayload(payload)

  await collection.updateOne(
    { id: normalized.id },
    {
      $set: {
        ...normalized,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true },
  )

  const document = await collection.findOne({ id: normalized.id })
  const member = document ? normalizeTeamMember(document) : null

  if (!member) {
    throw new Error("Team member could not be saved.")
  }

  return toAdminTeamMember(member)
}

export async function deleteTeamMember(id: string) {
  const database = await getMongoDb()

  if (!database) {
    throw new Error("MongoDB is not configured.")
  }

  const normalizedId = id.trim()

  if (!normalizedId) {
    throw new Error("Team member id is required.")
  }

  const result = await getTeamCollection(database).deleteOne({ id: normalizedId })

  return result.deletedCount > 0
}
