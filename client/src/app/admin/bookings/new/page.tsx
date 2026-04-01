"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import {
  DashboardButton,
  DashboardPage,
  InlineNotice,
  PageHero,
  Surface,
} from "@/components/dashboard/DashboardPrimitives"
import { useToast } from "@/components/dashboard/ToastProvider"
import { getButtonClassName } from "@/components/ui/Button/Button"
import { adminApi, AdminApiError } from "@/lib/admin-client"
import styles from "@/app/admin/bookings/new/page.module.css"

type BookingFormState = {
  clientName: string
  clientEmail: string
  clientPhone: string
  eventType: string
  packageName: string
  packageLabel: string
  location: string
  city: string
  eventDate: string
  guestCount: string
  budgetMin: string
  budgetMax: string
  addOns: string
  notes: string
  proposalTitle: string
  proposalPrice: string
  proposalScope: string
  proposalDeliverables: string
  proposalTimeline: string
  proposalNotes: string
}

const initialFormState: BookingFormState = {
  clientName: "",
  clientEmail: "",
  clientPhone: "",
  eventType: "",
  packageName: "",
  packageLabel: "",
  location: "",
  city: "",
  eventDate: "",
  guestCount: "",
  budgetMin: "",
  budgetMax: "",
  addOns: "",
  notes: "",
  proposalTitle: "",
  proposalPrice: "",
  proposalScope: "",
  proposalDeliverables: "",
  proposalTimeline: "",
  proposalNotes: "",
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return undefined

  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseAddOns(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

export default function AdminOfflineBookingPage() {
  const router = useRouter()
  const { pushToast } = useToast()
  const [form, setForm] = useState<BookingFormState>(initialFormState)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canSubmit = useMemo(
    () =>
      [
        form.clientName,
        form.clientEmail,
        form.eventType,
        form.location,
        form.eventDate,
        form.proposalPrice,
        form.proposalScope,
        form.proposalDeliverables,
        form.proposalTimeline,
      ].every((value) => value.trim().length > 0),
    [form],
  )

  const updateField = (key: keyof BookingFormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!canSubmit || isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    let leadId: string | null = null
    const proposalPrice = parseOptionalNumber(form.proposalPrice)

    if (proposalPrice === undefined) {
      setSubmitError("Quoted amount must be a valid number.")
      setIsSubmitting(false)
      return
    }

    try {
      const lead = await adminApi.createOfflineLead({
        clientName: form.clientName.trim(),
        clientEmail: form.clientEmail.trim(),
        clientPhone: form.clientPhone.trim() || undefined,
        eventType: form.eventType.trim(),
        packageName: form.packageName.trim() || undefined,
        packageLabel: form.packageLabel.trim() || undefined,
        location: form.location.trim(),
        city: form.city.trim() || undefined,
        eventDate: new Date(form.eventDate).toISOString(),
        guestCount: parseOptionalNumber(form.guestCount),
        budgetMin: parseOptionalNumber(form.budgetMin),
        budgetMax: parseOptionalNumber(form.budgetMax),
        addOns: parseAddOns(form.addOns),
        notes: form.notes.trim() || undefined,
      })

      leadId = lead.id

      await adminApi.createProposal({
        leadId: lead.id,
        title:
          form.proposalTitle.trim() ||
          `${form.eventType.trim()} proposal for ${form.clientName.trim()}`,
        price: proposalPrice,
        scope: form.proposalScope.trim(),
        deliverables: form.proposalDeliverables.trim(),
        timeline: form.proposalTimeline.trim(),
        notes: form.proposalNotes.trim() || undefined,
        status: "SENT",
      })

      pushToast({
        title: "Booking and proposal created",
        description:
          "The client can now review the proposal in the client portal with OTP access.",
        tone: "success",
      })
      router.push(`/admin/bookings/${lead.id}`)
      return
    } catch (error) {
      const message =
        error instanceof AdminApiError
          ? error.message
          : "Unable to create the booking right now."

      if (leadId) {
        setSubmitError(
          `${message} The booking was created, but the proposal could not be sent automatically.`,
        )
        pushToast({
          title: "Booking created",
          description:
            "The lead exists, but the proposal email was not sent. Open the booking and resend the proposal from there.",
          tone: "default",
        })
        router.push(`/admin/bookings/${leadId}`)
        return
      }

      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardPage className={styles.stack}>
      <PageHero
        eyebrow="Offline Booking"
        title="Create a client booking and send the proposal in one controlled flow."
        description="Use this intake when the client did not submit the booking online. We will create the client-backed booking first, then send the proposal through the normal portal lifecycle."
        secondaryAction={{ label: "Back to bookings", href: "/admin/bookings" }}
      />

      {submitError ? (
        <InlineNotice
          tone="warning"
          title="We hit a problem while creating this booking"
          description={submitError}
        />
      ) : null}

      <form className={styles.form} onSubmit={handleSubmit}>
        <Surface
          title="Client details"
          description="This client will receive the proposal email and use OTP access to open the portal."
        >
          <div className={`${styles.grid} ${styles.gridColumns2}`}>
            <label className={styles.field}>
              <span className={styles.label}>Client name</span>
              <input
                className={styles.input}
                value={form.clientName}
                onChange={(event) => updateField("clientName", event.target.value)}
                placeholder="Riya Malhotra"
                autoComplete="name"
                required
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Client email</span>
              <input
                className={styles.input}
                type="email"
                value={form.clientEmail}
                onChange={(event) => updateField("clientEmail", event.target.value)}
                placeholder="riya@example.com"
                autoComplete="email"
                required
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Phone</span>
              <input
                className={styles.input}
                value={form.clientPhone}
                onChange={(event) => updateField("clientPhone", event.target.value)}
                placeholder="+91 98765 43210"
                autoComplete="tel"
              />
            </label>
          </div>
        </Surface>

        <Surface
          title="Event brief"
          description="Capture the booking context the same way the public intake does."
        >
          <div className={`${styles.grid} ${styles.gridColumns2}`}>
            <label className={styles.field}>
              <span className={styles.label}>Event type</span>
              <input
                className={styles.input}
                value={form.eventType}
                onChange={(event) => updateField("eventType", event.target.value)}
                placeholder="Corporate cocktail night"
                required
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Service name</span>
              <input
                className={styles.input}
                value={form.packageName}
                onChange={(event) => updateField("packageName", event.target.value)}
                placeholder="Signature cocktail service"
              />
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span className={styles.label}>Service summary</span>
              <input
                className={styles.input}
                value={form.packageLabel}
                onChange={(event) => updateField("packageLabel", event.target.value)}
                placeholder="Premium cocktail service for 120 guests"
              />
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span className={styles.label}>Venue or location</span>
              <input
                className={styles.input}
                value={form.location}
                onChange={(event) => updateField("location", event.target.value)}
                placeholder="Indiranagar rooftop, Bengaluru"
                required
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>City</span>
              <input
                className={styles.input}
                value={form.city}
                onChange={(event) => updateField("city", event.target.value)}
                placeholder="Bengaluru"
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Event date</span>
              <input
                className={styles.input}
                type="datetime-local"
                value={form.eventDate}
                onChange={(event) => updateField("eventDate", event.target.value)}
                required
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Guest count</span>
              <input
                className={styles.input}
                inputMode="numeric"
                value={form.guestCount}
                onChange={(event) => updateField("guestCount", event.target.value)}
                placeholder="120"
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Budget minimum</span>
              <input
                className={styles.input}
                inputMode="numeric"
                value={form.budgetMin}
                onChange={(event) => updateField("budgetMin", event.target.value)}
                placeholder="75000"
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Budget maximum</span>
              <input
                className={styles.input}
                inputMode="numeric"
                value={form.budgetMax}
                onChange={(event) => updateField("budgetMax", event.target.value)}
                placeholder="150000"
              />
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span className={styles.label}>Add-ons</span>
              <input
                className={styles.input}
                value={form.addOns}
                onChange={(event) => updateField("addOns", event.target.value)}
                placeholder="Molecular cocktails, flair bartenders, mocktail counter"
              />
              <span className={styles.helper}>Separate add-ons with commas.</span>
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span className={styles.label}>Internal brief</span>
              <textarea
                className={styles.textarea}
                value={form.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                placeholder="Client prefers a premium welcome serve and a clean non-alcoholic station."
              />
            </label>
          </div>
        </Surface>

        <Surface
          title="Proposal to send"
          description="This proposal is sent immediately after the booking is created, so the client experiences the same portal flow as an online booking."
        >
          <div className={`${styles.grid} ${styles.gridColumns2}`}>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span className={styles.label}>Proposal title</span>
              <input
                className={styles.input}
                value={form.proposalTitle}
                onChange={(event) => updateField("proposalTitle", event.target.value)}
                placeholder="Optional. We can generate this from the event and client name."
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Quoted amount</span>
              <input
                className={styles.input}
                inputMode="numeric"
                value={form.proposalPrice}
                onChange={(event) => updateField("proposalPrice", event.target.value)}
                placeholder="120000"
                required
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Timeline</span>
              <input
                className={styles.input}
                value={form.proposalTimeline}
                onChange={(event) => updateField("proposalTimeline", event.target.value)}
                placeholder="Proposal valid for 7 days. Delivery planning starts immediately after approval."
                required
              />
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span className={styles.label}>Scope</span>
              <textarea
                className={styles.textarea}
                value={form.proposalScope}
                onChange={(event) => updateField("proposalScope", event.target.value)}
                placeholder="Describe the service scope, bar setup, staffing, and event support."
                required
              />
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span className={styles.label}>Deliverables</span>
              <textarea
                className={styles.textarea}
                value={form.proposalDeliverables}
                onChange={(event) => updateField("proposalDeliverables", event.target.value)}
                placeholder="List inclusions, equipment, staffing, and outputs the client will receive."
                required
              />
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span className={styles.label}>Proposal notes</span>
              <textarea
                className={styles.textarea}
                value={form.proposalNotes}
                onChange={(event) => updateField("proposalNotes", event.target.value)}
                placeholder="Add commercial notes, assumptions, or payment context."
              />
            </label>
          </div>
        </Surface>

        <div className={styles.actions}>
          <Link href="/admin/bookings" className={getButtonClassName({ variant: "ghost" })}>
            Cancel
          </Link>
          <DashboardButton type="submit" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? "Creating booking..." : "Create booking and send proposal"}
          </DashboardButton>
        </div>
      </form>
    </DashboardPage>
  )
}
