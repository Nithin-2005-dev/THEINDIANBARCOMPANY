"use client"

import Link from "next/link"
import { startTransition, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { TEAM_CATEGORIES, getTeamCategoryLabel, sortTeamMembers } from "@/lib/team"
import type { AdminTeamMember, TeamCategory, TeamMemberMutationPayload } from "@/types/team"
import styles from "./page.module.css"

type LocalTeamManagerProps = {
  initialMembers: AdminTeamMember[]
}

type TeamDraft = {
  id: string
  name: string
  designation: string
  category: TeamCategory
  bio: string
  photoUrl: string
  instagramUrl: string
  linkedInUrl: string
  websiteUrl: string
  email: string
  isActive: boolean
  isVisible: boolean
  sortOrder: number
}

function createEmptyDraft(category: TeamCategory = "CORE"): TeamDraft {
  return {
    id: "",
    name: "",
    designation: "",
    category,
    bio: "",
    photoUrl: "",
    instagramUrl: "",
    linkedInUrl: "",
    websiteUrl: "",
    email: "",
    isActive: true,
    isVisible: true,
    sortOrder: 0,
  }
}

function createDraftFromMember(member: AdminTeamMember): TeamDraft {
  return {
    id: member.id,
    name: member.name,
    designation: member.designation,
    category: member.category,
    bio: member.bio ?? "",
    photoUrl: member.photoUrl ?? "",
    instagramUrl: member.instagramUrl ?? "",
    linkedInUrl: member.linkedInUrl ?? "",
    websiteUrl: member.websiteUrl ?? "",
    email: member.email ?? "",
    isActive: member.isActive,
    isVisible: member.isVisible,
    sortOrder: member.sortOrder,
  }
}

function toPayload(draft: TeamDraft): TeamMemberMutationPayload {
  return {
    id: draft.id || undefined,
    name: draft.name,
    designation: draft.designation,
    category: draft.category,
    bio: draft.bio,
    photoUrl: draft.photoUrl,
    instagramUrl: draft.instagramUrl,
    linkedInUrl: draft.linkedInUrl,
    websiteUrl: draft.websiteUrl,
    email: draft.email,
    isActive: draft.isActive,
    isVisible: draft.isVisible,
    sortOrder: draft.sortOrder,
  }
}

function upsertMember(members: AdminTeamMember[], nextMember: AdminTeamMember) {
  return sortTeamMembers([
    ...members.filter((member) => member.id !== nextMember.id),
    nextMember,
  ])
}

export default function LocalTeamManager({ initialMembers }: LocalTeamManagerProps) {
  const router = useRouter()
  const [members, setMembers] = useState(() => sortTeamMembers(initialMembers))
  const [selectedId, setSelectedId] = useState<string | null>(initialMembers[0]?.id ?? null)
  const [draft, setDraft] = useState<TeamDraft>(() =>
    initialMembers[0] ? createDraftFromMember(initialMembers[0]) : createEmptyDraft(),
  )
  const [isPending, setIsPending] = useState(false)
  const [status, setStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null)

  const selectedMember = useMemo(
    () => members.find((member) => member.id === selectedId) ?? null,
    [members, selectedId],
  )

  function setField<K extends keyof TeamDraft>(field: K, value: TeamDraft[K]) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function handleCreateNew() {
    setSelectedId(null)
    setDraft(createEmptyDraft(draft.category))
    setStatus(null)
  }

  function handleSelectMember(member: AdminTeamMember) {
    setSelectedId(member.id)
    setDraft(createDraftFromMember(member))
    setStatus(null)
  }

  async function handleSave() {
    setIsPending(true)
    setStatus(null)

    try {
      const response = await fetch("/api/local/team", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(toPayload(draft)),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Unable to save team member.")
      }

      const member = data as AdminTeamMember
      setMembers((current) => upsertMember(current, member))
      setSelectedId(member.id)
      setDraft(createDraftFromMember(member))
      setStatus({ tone: "success", message: "Team member saved to MongoDB Atlas." })
      router.refresh()
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to save team member.",
      })
    } finally {
      setIsPending(false)
    }
  }

  async function handleDelete() {
    if (!selectedMember) {
      return
    }

    setIsPending(true)
    setStatus(null)

    try {
      const response = await fetch(`/api/local/team/${encodeURIComponent(selectedMember.id)}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok || !data?.deleted) {
        throw new Error(typeof data?.error === "string" ? data.error : "Unable to delete team member.")
      }

      const remainingMembers = members.filter((member) => member.id !== selectedMember.id)
      setMembers(remainingMembers)

      if (remainingMembers[0]) {
        setSelectedId(remainingMembers[0].id)
        setDraft(createDraftFromMember(remainingMembers[0]))
      } else {
        setSelectedId(null)
        setDraft(createEmptyDraft())
      }

      setStatus({ tone: "success", message: "Team member deleted from MongoDB Atlas." })
      router.refresh()
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to delete team member.",
      })
    } finally {
      setIsPending(false)
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Local Only</p>
          <h1 className={styles.title}>Team Upload Studio</h1>
          <p className={styles.copy}>
            This page works only on localhost and writes team members directly to your MongoDB Atlas collection.
          </p>
        </div>

        <div className={styles.headerActions}>
          <Link href="/" className={styles.secondaryLink}>
            Home
          </Link>
          <Link href="/team" className={styles.primaryLink}>
            View Team Page
          </Link>
        </div>
      </header>

      <section className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTop}>
            <div>
              <p className={styles.sidebarLabel}>Saved Members</p>
              <strong className={styles.sidebarCount}>{String(members.length).padStart(2, "0")}</strong>
            </div>

            <button type="button" className={styles.createButton} onClick={handleCreateNew}>
              New Member
            </button>
          </div>

          <div className={styles.memberList}>
            {members.length ? (
              members.map((member) => {
                const active = member.id === selectedId

                return (
                  <button
                    key={member.id}
                    type="button"
                    className={`${styles.memberCard} ${active ? styles.memberCardActive : ""}`}
                    onClick={() => handleSelectMember(member)}
                  >
                    <span className={styles.memberCategory}>{getTeamCategoryLabel(member.category)}</span>
                    <strong className={styles.memberName}>{member.name}</strong>
                    <span className={styles.memberRole}>{member.designation}</span>
                  </button>
                )
              })
            ) : (
              <p className={styles.emptyState}>No team members yet. Create the first one from this screen.</p>
            )}
          </div>
        </aside>

        <div className={styles.editor}>
          {status ? (
            <div className={`${styles.notice} ${status.tone === "error" ? styles.noticeError : styles.noticeSuccess}`}>
              {status.message}
            </div>
          ) : null}

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Name</span>
              <input value={draft.name} onChange={(event) => setField("name", event.target.value)} />
            </label>

            <label className={styles.field}>
              <span>Designation</span>
              <input
                value={draft.designation}
                onChange={(event) => setField("designation", event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span>Category</span>
              <select
                value={draft.category}
                onChange={(event) => setField("category", event.target.value as TeamCategory)}
              >
                {TEAM_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {getTeamCategoryLabel(category)}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Sort Order</span>
              <input
                type="number"
                value={draft.sortOrder}
                onChange={(event) => setField("sortOrder", Number(event.target.value) || 0)}
              />
            </label>

            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span>Photo URL</span>
              <input value={draft.photoUrl} onChange={(event) => setField("photoUrl", event.target.value)} />
            </label>

            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span>Bio</span>
              <textarea value={draft.bio} onChange={(event) => setField("bio", event.target.value)} rows={4} />
            </label>

            <label className={styles.field}>
              <span>Instagram URL</span>
              <input
                value={draft.instagramUrl}
                onChange={(event) => setField("instagramUrl", event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span>LinkedIn URL</span>
              <input value={draft.linkedInUrl} onChange={(event) => setField("linkedInUrl", event.target.value)} />
            </label>

            <label className={styles.field}>
              <span>Website URL</span>
              <input value={draft.websiteUrl} onChange={(event) => setField("websiteUrl", event.target.value)} />
            </label>

            <label className={styles.field}>
              <span>Email</span>
              <input value={draft.email} onChange={(event) => setField("email", event.target.value)} />
            </label>
          </div>

          <div className={styles.toggleRow}>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(event) => setField("isActive", event.target.checked)}
              />
              <span>Active</span>
            </label>

            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={draft.isVisible}
                onChange={(event) => setField("isVisible", event.target.checked)}
              />
              <span>Visible on public team page</span>
            </label>
          </div>

          <div className={styles.actions}>
            <div className={styles.meta}>
              <span>Document ID</span>
              <code>{draft.id || "Auto-generated on save"}</code>
            </div>

            <div className={styles.actionButtons}>
              {selectedMember ? (
                <button
                  type="button"
                  className={styles.deleteButton}
                  disabled={isPending}
                  onClick={() => startTransition(() => void handleDelete())}
                >
                  Delete
                </button>
              ) : null}

              <button
                type="button"
                className={styles.saveButton}
                disabled={isPending}
                onClick={() => startTransition(() => void handleSave())}
              >
                {isPending ? "Saving..." : "Save to MongoDB"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
