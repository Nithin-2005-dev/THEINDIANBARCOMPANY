"use client"

import Image from "next/image"
import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react"
import Button from "@/components/ui/Button/Button"
import Input from "@/components/ui/Input/Input"
import { getTeamCategoryLabel, getTeamInitials, TEAM_CATEGORIES } from "@/lib/team"
import type { AdminTeamMember, TeamCategory } from "@/types/team"
import styles from "./TeamForm.module.css"

const MAX_TEAM_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

type FormErrors = Partial<
  Record<
    | "name"
    | "designation"
    | "instagramUrl"
    | "linkedInUrl"
    | "websiteUrl"
    | "email"
    | "sortOrder"
    | "imageFile",
    string
  >
>

export type TeamFormSubmission = {
  name: string
  designation: string
  category: TeamCategory
  bio: string
  instagramUrl: string
  linkedInUrl: string
  websiteUrl: string
  email: string
  isActive: boolean
  isVisible: boolean
  sortOrder: number
  imageFile: File | null
  removePhoto: boolean
}

type TeamFormProps = {
  member?: AdminTeamMember | null
  isSubmitting?: boolean
  onCancel: () => void
  onSubmit: (values: TeamFormSubmission) => Promise<void> | void
}

function normalizeUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function isValidUrl(value: string) {
  if (!value.trim()) return true

  try {
    new URL(normalizeUrl(value))
    return true
  } catch {
    return false
  }
}

function isValidEmail(value: string) {
  if (!value.trim()) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export default function TeamForm({
  member,
  isSubmitting = false,
  onCancel,
  onSubmit,
}: TeamFormProps) {
  const [name, setName] = useState("")
  const [designation, setDesignation] = useState("")
  const [category, setCategory] = useState<TeamCategory>("CORE")
  const [bio, setBio] = useState("")
  const [instagramUrl, setInstagramUrl] = useState("")
  const [linkedInUrl, setLinkedInUrl] = useState("")
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [email, setEmail] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [isVisible, setIsVisible] = useState(true)
  const [sortOrder, setSortOrder] = useState("0")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const fileInputId = useId()
  const previewObjectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    setName(member?.name ?? "")
    setDesignation(member?.designation ?? "")
    setCategory(member?.category ?? "CORE")
    setBio(member?.bio ?? "")
    setInstagramUrl(member?.instagramUrl ?? "")
    setLinkedInUrl(member?.linkedInUrl ?? "")
    setWebsiteUrl(member?.websiteUrl ?? "")
    setEmail(member?.email ?? "")
    setIsActive(member?.isActive ?? true)
    setIsVisible(member?.isVisible ?? true)
    setSortOrder(String(member?.sortOrder ?? 0))
    setImageFile(null)
    setRemovePhoto(false)
    setErrors({})

    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current)
      previewObjectUrlRef.current = null
    }

    setPreviewUrl(member?.photoUrl ?? null)
  }, [member])

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current)
      }
    }
  }, [])

  const applyPreviewFile = (file: File | null) => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current)
      previewObjectUrlRef.current = null
    }

    if (file) {
      const objectUrl = URL.createObjectURL(file)
      previewObjectUrlRef.current = objectUrl
      setPreviewUrl(objectUrl)
      return
    }

    setPreviewUrl(removePhoto ? null : member?.photoUrl ?? null)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    if (!file) {
      setImageFile(null)
      applyPreviewFile(null)
      return
    }

    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      setErrors((current) => ({
        ...current,
        imageFile: "Upload a JPG, PNG, or WebP image.",
      }))
      event.target.value = ""
      return
    }

    if (file.size > MAX_TEAM_IMAGE_SIZE_BYTES) {
      setErrors((current) => ({
        ...current,
        imageFile: "Images must be 5 MB or smaller.",
      }))
      event.target.value = ""
      return
    }

    setErrors((current) => {
      const next = { ...current }
      delete next.imageFile
      return next
    })
    setRemovePhoto(false)
    setImageFile(file)
    applyPreviewFile(file)
  }

  const handleRemovePhoto = () => {
    if (imageFile) {
      setImageFile(null)
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current)
        previewObjectUrlRef.current = null
      }
      setPreviewUrl(member?.photoUrl ?? null)
      setRemovePhoto(false)
      return
    }

    setImageFile(null)
    setRemovePhoto(true)
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current)
      previewObjectUrlRef.current = null
    }
    setPreviewUrl(null)
  }

  const validate = () => {
    const nextErrors: FormErrors = {}

    if (!name.trim()) nextErrors.name = "Name is required."
    if (!designation.trim()) nextErrors.designation = "Designation is required."
    if (!isValidUrl(instagramUrl)) nextErrors.instagramUrl = "Enter a valid Instagram URL."
    if (!isValidUrl(linkedInUrl)) nextErrors.linkedInUrl = "Enter a valid LinkedIn URL."
    if (!isValidUrl(websiteUrl)) nextErrors.websiteUrl = "Enter a valid website URL."
    if (!isValidEmail(email)) nextErrors.email = "Enter a valid email address."

    const parsedOrder = Number.parseInt(sortOrder, 10)
    if (!Number.isInteger(parsedOrder) || parsedOrder < 0) {
      nextErrors.sortOrder = "Order must be 0 or greater."
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validate()) return

    await onSubmit({
      name: name.trim(),
      designation: designation.trim(),
      category,
      bio: bio.trim(),
      instagramUrl: instagramUrl.trim(),
      linkedInUrl: linkedInUrl.trim(),
      websiteUrl: websiteUrl.trim(),
      email: email.trim(),
      isActive,
      isVisible,
      sortOrder: Number.parseInt(sortOrder, 10),
      imageFile,
      removePhoto,
    })
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.layout}>
        <section className={styles.previewPanel}>
          <div className={styles.previewCard}>
            <div className={styles.previewFrame}>
              {previewUrl ? (
                <Image
                  src={previewUrl}
                  alt={name ? `${name} preview` : "Team member preview"}
                  fill
                  unoptimized
                  sizes="280px"
                  className={styles.previewImage}
                />
              ) : (
                <div className={styles.previewFallback}>{getTeamInitials(name || "Team")}</div>
              )}
            </div>
            <div className={styles.previewMeta}>
              <p className={styles.previewEyebrow}>Cloudinary delivery</p>
              <strong className={styles.previewTitle}>{name.trim() || "Team Member"}</strong>
              <span className={styles.previewSubtitle}>{designation.trim() || "Designation"}</span>
            </div>
          </div>

          <label htmlFor={fileInputId} className={styles.uploadField}>
            <span className={styles.uploadLabel}>Profile Photo</span>
            <span className={styles.uploadHint}>JPG, PNG, or WebP. Recommended 512 x 512.</span>
            <span className={styles.uploadAction}>Choose image</span>
          </label>
          <input
            id={fileInputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className={styles.fileInput}
            onChange={handleFileChange}
          />
          {errors.imageFile ? <p className={styles.inlineError}>{errors.imageFile}</p> : null}

          {previewUrl ? (
            <button type="button" className={styles.removePhoto} onClick={handleRemovePhoto}>
              {imageFile ? "Clear selected image" : "Remove current photo"}
            </button>
          ) : null}
        </section>

        <section className={styles.fields}>
          <div className={styles.fieldGrid}>
            <Input
              label="Full Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={errors.name}
              placeholder="Enter full name"
            />
            <Input
              label="Designation / Role"
              value={designation}
              onChange={(event) => setDesignation(event.target.value)}
              error={errors.designation}
              placeholder="Founder, Trustee, Brand Partner..."
            />
            <label className={styles.selectField}>
              <span className={styles.fieldLabel}>Category</span>
              <select value={category} onChange={(event) => setCategory(event.target.value as TeamCategory)}>
                {TEAM_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {getTeamCategoryLabel(item)}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Display Order"
              type="number"
              min={0}
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              error={errors.sortOrder}
            />
          </div>

          <label className={styles.textareaField}>
            <span className={styles.fieldLabel}>Description / Bio</span>
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              rows={5}
              maxLength={600}
              placeholder="A short description about experience, focus, or contribution."
            />
          </label>

          <div className={styles.fieldGrid}>
            <Input
              label="Instagram"
              value={instagramUrl}
              onChange={(event) => setInstagramUrl(event.target.value)}
              error={errors.instagramUrl}
              placeholder="instagram.com/..."
            />
            <Input
              label="LinkedIn"
              value={linkedInUrl}
              onChange={(event) => setLinkedInUrl(event.target.value)}
              error={errors.linkedInUrl}
              placeholder="linkedin.com/in/..."
            />
            <Input
              label="Website"
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              error={errors.websiteUrl}
              placeholder="www.example.com"
            />
            <Input
              label="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={errors.email}
              placeholder="hello@example.com"
            />
          </div>

          <div className={styles.toggleGrid}>
            <label className={styles.toggleCard}>
              <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
              <div>
                <strong>Active</strong>
                <span>Inactive members stay in admin records but disappear from the public roster.</span>
              </div>
            </label>

            <label className={styles.toggleCard}>
              <input type="checkbox" checked={isVisible} onChange={(event) => setIsVisible(event.target.checked)} />
              <div>
                <strong>Visible on site</strong>
                <span>Use this to hide a profile without removing its data.</span>
              </div>
            </label>
          </div>
        </section>
      </div>

      <div className={styles.actions}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {member ? "Save Team Member" : "Add Team Member"}
        </Button>
      </div>
    </form>
  )
}
