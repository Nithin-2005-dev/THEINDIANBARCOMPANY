"use client"

import Image from "next/image"
import { useDeferredValue, useMemo, useState } from "react"
import {
  DashboardPage,
  DashboardScreenLoader,
  DashboardSearchField,
  ErrorState,
  StatusIndicator,
} from "@/components/dashboard/DashboardPrimitives"
import { useToast } from "@/components/dashboard/ToastProvider"
import { useAdminResource } from "@/components/admin/useAdminResource"
import Button from "@/components/ui/Button/Button"
import Modal from "@/components/ui/Modal/Modal"
import { showApiErrorToast } from "@/lib/api"
import { adminApi } from "@/lib/admin-client"
import { getTeamCategoryLabel, getTeamInitials, sortTeamMembers, TEAM_CATEGORIES } from "@/lib/team"
import type {
  AdminTeamMember,
  TeamCategory,
  TeamImageUploadSignature,
  TeamMemberMutationPayload,
} from "@/types/team"
import TeamForm, { type TeamFormSubmission } from "./TeamForm/TeamForm"
import styles from "./page.module.css"

type CategoryFilter = "ALL" | TeamCategory
type VisibilityFilter = "ALL" | "LIVE" | "INACTIVE" | "HIDDEN"

async function uploadTeamImageToCloudinary(file: File, signature: TeamImageUploadSignature) {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("api_key", signature.apiKey)
  formData.append("folder", signature.folder)
  formData.append("public_id", signature.publicId)
  formData.append("signature", signature.signature)
  formData.append("timestamp", String(signature.timestamp))

  const response = await fetch(signature.uploadUrl, {
    method: "POST",
    body: formData,
  })

  if (!response.ok) {
    throw new Error("Photo upload failed. Please try again.")
  }

  const data = (await response.json()) as {
    secure_url?: string
    public_id?: string
  }

  if (!data.secure_url || !data.public_id) {
    throw new Error("Cloudinary did not return a usable image.")
  }

  return {
    publicId: data.public_id,
    secureUrl: data.secure_url,
  }
}

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function matchesSearch(member: AdminTeamMember, query: string) {
  if (!query.trim()) return true

  const haystack = [
    member.name,
    member.designation,
    member.bio,
    member.email,
    member.instagramUrl,
    member.linkedInUrl,
    member.websiteUrl,
    getTeamCategoryLabel(member.category),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  return haystack.includes(query.trim().toLowerCase())
}

function showTeamRequestError(
  pushToast: ReturnType<typeof useToast>["pushToast"],
  error: unknown,
  title: string,
) {
  if (error instanceof Error) {
    pushToast({
      title,
      description: error.message,
      tone: "error",
    })
    return
  }

  showApiErrorToast({ pushToast }, error, title)
}

export default function TeamManagementPage() {
  const { pushToast } = useToast()
  const me = useAdminResource(() => adminApi.me(), [])
  const team = useAdminResource(() => adminApi.listTeamMembers(), [])
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL")
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("ALL")
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<AdminTeamMember | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminTeamMember | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const deferredSearch = useDeferredValue(search)

  const isAdmin = me.data?.role === "ADMIN"
  const members = useMemo(() => sortTeamMembers(team.data ?? []), [team.data])
  const filteredMembers = useMemo(
    () =>
      members.filter((member) => {
        if (!matchesSearch(member, deferredSearch)) return false
        if (categoryFilter !== "ALL" && member.category !== categoryFilter) return false
        if (visibilityFilter === "LIVE" && (!member.isActive || !member.isVisible)) return false
        if (visibilityFilter === "INACTIVE" && member.isActive) return false
        if (visibilityFilter === "HIDDEN" && member.isVisible) return false
        return true
      }),
    [categoryFilter, deferredSearch, members, visibilityFilter],
  )

  const liveCount = members.filter((member) => member.isActive && member.isVisible).length
  const inactiveCount = members.filter((member) => !member.isActive).length
  const hiddenCount = members.filter((member) => !member.isVisible).length
  const syncTone = team.isRefreshing ? "warning" : team.error ? "danger" : "success"

  const openCreateModal = () => {
    setEditingMember(null)
    setEditorOpen(true)
  }

  const openEditModal = (member: AdminTeamMember) => {
    setEditingMember(member)
    setEditorOpen(true)
  }

  const closeEditor = () => {
    if (isSubmitting) return
    setEditorOpen(false)
    setEditingMember(null)
  }

  const handleSubmit = async (values: TeamFormSubmission) => {
    setIsSubmitting(true)
    let uploadedImage: { publicId: string; secureUrl: string } | null = null

    try {
      if (values.imageFile) {
        const signature = await adminApi.getTeamImageUploadSignature({
          fileName: values.imageFile.name,
          contentType: values.imageFile.type,
          sizeBytes: values.imageFile.size,
        })

        uploadedImage = await uploadTeamImageToCloudinary(values.imageFile, signature)
      }

      const payload: TeamMemberMutationPayload = {
        name: values.name,
        designation: values.designation,
        category: values.category,
        bio: values.bio || undefined,
        instagramUrl: values.instagramUrl || undefined,
        linkedInUrl: values.linkedInUrl || undefined,
        websiteUrl: values.websiteUrl || undefined,
        email: values.email || undefined,
        isActive: values.isActive,
        isVisible: values.isVisible,
        sortOrder: values.sortOrder,
        ...(editingMember && values.removePhoto ? { removePhoto: true } : {}),
        ...(uploadedImage
          ? {
              photoUrl: uploadedImage.secureUrl,
              photoPublicId: uploadedImage.publicId,
            }
          : {}),
      }

      if (editingMember) {
        await adminApi.updateTeamMember(editingMember.id, payload)
        pushToast({
          title: "Team member updated",
          description: `${values.name} is ready for the public roster.`,
          tone: "success",
        })
      } else {
        await adminApi.createTeamMember(payload)
        pushToast({
          title: "Team member added",
          description: `${values.name} has been added to the roster.`,
          tone: "success",
        })
      }

      closeEditor()
      await team.reload("manual")
    } catch (error) {
      if (uploadedImage?.publicId) {
        await adminApi.deleteTeamImage(uploadedImage.publicId).catch(() => undefined)
      }

      showTeamRequestError(
        pushToast,
        error,
        editingMember ? "Unable to update team member" : "Unable to add team member",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    try {
      await adminApi.deleteTeamMember(deleteTarget.id)
      pushToast({
        title: "Team member removed",
        description: `${deleteTarget.name} has been removed from the roster.`,
        tone: "success",
      })
      setDeleteTarget(null)
      await team.reload("manual")
    } catch (error) {
      showTeamRequestError(pushToast, error, "Unable to delete team member")
    } finally {
      setIsDeleting(false)
    }
  }

  if (team.isLoading && !team.data) {
    return <DashboardScreenLoader metricCount={4} />
  }

  if (me.data && !isAdmin) {
    return (
      <DashboardPage>
        <ErrorState
          title="Access restricted"
          description="Only admins can manage public team members."
        />
      </DashboardPage>
    )
  }

  if (team.error && !team.data) {
    return (
      <DashboardPage>
        <ErrorState
          title="Team roster unavailable"
          description={team.error}
          action={{
            label: "Retry",
            onClick: () => void team.reload("manual"),
          }}
        />
      </DashboardPage>
    )
  }

  return (
    <DashboardPage className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Public Team Management</p>
          <h1 className={styles.title}>Shape the public-facing bartender roster.</h1>
          <p className={styles.description}>
            Add, update, hide, and retire team profiles with Cloudinary-backed images and strict admin-only control.
          </p>
        </div>

        <div className={styles.heroActions}>
          <StatusIndicator tone={syncTone}>
            {team.isRefreshing ? "Syncing roster" : "Roster ready"}
          </StatusIndicator>
          {isAdmin ? <Button onClick={openCreateModal}>Add Team Member</Button> : null}
        </div>
      </section>

      <section className={styles.metricGrid}>
        <article className={styles.metricCard}>
          <span>Total Profiles</span>
          <strong>{members.length}</strong>
        </article>
        <article className={styles.metricCard}>
          <span>Live on Site</span>
          <strong>{liveCount}</strong>
        </article>
        <article className={styles.metricCard}>
          <span>Inactive</span>
          <strong>{inactiveCount}</strong>
        </article>
        <article className={styles.metricCard}>
          <span>Hidden</span>
          <strong>{hiddenCount}</strong>
        </article>
      </section>

      <section className={styles.workspace}>
        <div className={styles.toolbar}>
          <DashboardSearchField
            value={search}
            onChange={setSearch}
            placeholder="Search by name, role, category, or link"
            className={styles.search}
          />

          <div className={styles.filterGroup}>
            <div className={styles.filterPills}>
              <button
                type="button"
                className={`${styles.filterPill} ${categoryFilter === "ALL" ? styles.filterPillActive : ""}`}
                onClick={() => setCategoryFilter("ALL")}
              >
                All
              </button>
              {TEAM_CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`${styles.filterPill} ${
                    categoryFilter === category ? styles.filterPillActive : ""
                  }`}
                  onClick={() => setCategoryFilter(category)}
                >
                  {getTeamCategoryLabel(category)}
                </button>
              ))}
            </div>

            <div className={styles.filterPills}>
              {[
                { id: "ALL", label: "All Statuses" },
                { id: "LIVE", label: "Live" },
                { id: "INACTIVE", label: "Inactive" },
                { id: "HIDDEN", label: "Hidden" },
              ].map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  className={`${styles.filterPill} ${
                    visibilityFilter === filter.id ? styles.filterPillActive : ""
                  }`}
                  onClick={() => setVisibilityFilter(filter.id as VisibilityFilter)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.toolbarActions}>
            <span className={styles.resultCount}>
              {filteredMembers.length} {filteredMembers.length === 1 ? "member" : "members"}
            </span>
            <Button type="button" variant="secondary" onClick={() => void team.reload("manual")}>
              Refresh
            </Button>
          </div>
        </div>

        {filteredMembers.length ? (
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <span>Member</span>
              <span>Category</span>
              <span>Status</span>
              <span>Order</span>
              <span>Updated</span>
              <span>Actions</span>
            </div>

            {filteredMembers.map((member) => (
              <article key={member.id} className={styles.row}>
                <div className={styles.memberCell}>
                  <div className={styles.memberThumb}>
                    {member.photoUrl ? (
                      <Image
                        src={member.photoUrl}
                        alt={`${member.name} portrait`}
                        fill
                        sizes="64px"
                        className={styles.memberImage}
                      />
                    ) : (
                      <span className={styles.memberFallback}>{getTeamInitials(member.name)}</span>
                    )}
                  </div>
                  <div className={styles.memberCopy}>
                    <strong>{member.name}</strong>
                    <span>{member.designation}</span>
                  </div>
                </div>

                <div className={styles.dataCell}>
                  <span className={styles.categoryBadge}>{getTeamCategoryLabel(member.category)}</span>
                </div>

                <div className={styles.statusCell}>
                  <span className={`${styles.statusBadge} ${member.isActive ? styles.statusGood : styles.statusMuted}`}>
                    {member.isActive ? "Active" : "Inactive"}
                  </span>
                  <span className={`${styles.statusBadge} ${member.isVisible ? styles.statusGood : styles.statusWarning}`}>
                    {member.isVisible ? "Visible" : "Hidden"}
                  </span>
                </div>

                <div className={styles.dataCell}>#{member.sortOrder}</div>
                <div className={styles.dataCell}>{formatUpdatedAt(member.updatedAt)}</div>

                <div className={styles.actionCell}>
                  {isAdmin ? (
                    <>
                      <Button type="button" variant="secondary" size="sm" onClick={() => openEditModal(member)}>
                        Edit
                      </Button>
                      <Button type="button" variant="danger" size="sm" onClick={() => setDeleteTarget(member)}>
                        Delete
                      </Button>
                    </>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <h2>No team members match this view</h2>
            <p>Try clearing a filter or add a new profile to start building the public team page.</p>
            {isAdmin ? (
              <Button type="button" onClick={openCreateModal}>
                Add Team Member
              </Button>
            ) : null}
          </div>
        )}
      </section>

      <Modal
        open={editorOpen}
        onClose={closeEditor}
        size="xl"
        title={editingMember ? `Edit ${editingMember.name}` : "Add Team Member"}
        description="All profile photos are uploaded to Cloudinary and the roster is only manageable by admins."
      >
        <TeamForm
          member={editingMember}
          isSubmitting={isSubmitting}
          onCancel={closeEditor}
          onSubmit={handleSubmit}
        />
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (!isDeleting) setDeleteTarget(null)
        }}
        tone="danger"
        size="sm"
        title="Delete team member"
        description={
          deleteTarget
            ? `${deleteTarget.name} will be removed from the admin roster and public team page.`
            : undefined
        }
        footer={
          <div className={styles.deleteActions}>
            <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button type="button" variant="danger" loading={isDeleting} onClick={handleDelete}>
              Delete Member
            </Button>
          </div>
        }
      >
        <p className={styles.deleteCopy}>
          This also attempts to remove the associated Cloudinary image so the media library stays clean.
        </p>
      </Modal>
    </DashboardPage>
  )
}
