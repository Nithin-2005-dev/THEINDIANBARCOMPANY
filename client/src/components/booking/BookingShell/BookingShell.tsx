"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import BookingSuccessPanel from "@/components/booking/BookingSuccessPanel/BookingSuccessPanel"
import BookingSummary from "@/components/booking/BookingSummary/BookingSummary"
import ProgressBar from "@/components/booking/ProgressBar/ProgressBar"
import StepContact from "@/components/booking/StepContact/StepContact"
import StepEvent from "@/components/booking/StepEvent/StepEvent"
import StepPreferences from "@/components/booking/StepPreferences/StepPreferences"
import StepReview from "@/components/booking/StepReview/StepReview"
import {
  getBookingExperience,
  getBookingVisual,
} from "@/components/booking/booking-experience"
import BookingThemeScope from "@/components/booking-theme/BookingThemeScope"
import Navbar from "@/components/layout/Navbar/Navbar"
import {
  BOOKING_STEPS,
  BOOKING_STORAGE_KEY,
  type BookingFlowErrors,
  type BookingFlowValues,
  createBookingDraft,
  formatMoneyInput,
  formatPhoneInput,
  mergeBookingDraft,
  toLeadPayload,
} from "@/components/booking/booking-flow"
import {
  bookingServices,
  resolveBookingService,
} from "@/components/booking/booking-service-config"
import Button from "@/components/ui/Button/Button"
import { emitBookingEvent } from "@/lib/booking-analytics"
import { MIN_BOOKING_FILL_MS, validateBookingField } from "@/lib/booking-validation"
import { ApiError, createLead } from "@/lib/api"
import { siteConfig } from "@/lib/seo"
import type { CreateLeadPayload } from "@/types/leads"
import styles from "./BookingShell.module.css"

type BookingShellProps = {
  queryParams?: Record<string, string | string[] | undefined>
  serviceSlug?: string
}

const STEP_CTA_LABELS = [
  "Continue to Event Details",
  "Continue to Service Preferences",
  "Review My Service Plan",
  "Get My Tailored Quote",
]

const STEP_TIME_HINTS = [
  "about 90 seconds left",
  "about 60 seconds left",
  "about 30 seconds left",
  "ready to send",
]

function getQueryValue(
  value: string | string[] | undefined,
) {
  return Array.isArray(value) ? value[0] : value
}

const STEP_FIELDS: Array<Array<keyof BookingFlowValues>> = [
  ["name", "phone", "email", "preferredContact"],
  ["eventType", "location", "eventDate", "guestCount"],
  ["budgetMin", "budgetMax"],
  [],
]

function getStoredDraftKey(serviceKey: string | null) {
  return serviceKey ? `${BOOKING_STORAGE_KEY}:${serviceKey}` : `${BOOKING_STORAGE_KEY}:general`
}

function getValidationValues(values: BookingFlowValues) {
  return {
    ...values,
    budgetMin: values.budgetMin.replace(/[^\d]/g, ""),
    budgetMax: values.budgetMax.replace(/[^\d]/g, ""),
  }
}

function getFriendlyBookingError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message
  }

  return "Something slipped during submission. Please try again in a moment."
}

function getCompactResponseLabel(value?: string | null) {
  if (!value) return "Fast reply"

  const match = value.match(/(\d+)\s*(minute|minutes|hour|hours)/i)
  if (!match) return value

  const amount = match[1]
  const unit = match[2].toLowerCase().startsWith("hour") ? "hr" : "min"
  return `${amount} ${unit}`
}

export default function BookingShell({
  queryParams,
  serviceSlug,
}: BookingShellProps) {
  const formRef = useRef<HTMLFormElement | null>(null)
  const startedAtRef = useRef<number>(Date.now())
  const hasStartedAnalyticsRef = useRef(false)
  const lastFingerprintRef = useRef<string | null>(null)
  const resolvedServiceKey = serviceSlug ?? getQueryValue(queryParams?.service)
  const service = resolveBookingService(resolvedServiceKey)
  const supportHref = `tel:${siteConfig.phone.replace(/\s+/g, "")}`
  const experience = getBookingExperience(service)
  const visual = getBookingVisual(service)

  const requestSnapshot = useMemo(
    () =>
      createBookingDraft({
        service: resolvedServiceKey,
        packageGuests: getQueryValue(queryParams?.packageGuests),
        packageLabel: getQueryValue(queryParams?.packageLabel),
        packageName: getQueryValue(queryParams?.packageName),
        packagePrice: getQueryValue(queryParams?.packagePrice),
      }),
    [queryParams, resolvedServiceKey],
  )

  const storageKey = useMemo(
    () => getStoredDraftKey(service?.slug ?? null),
    [service?.slug],
  )

  const [currentStep, setCurrentStep] = useState(0)
  const [values, setValues] = useState<BookingFlowValues>(requestSnapshot)
  const [errors, setErrors] = useState<BookingFlowErrors>({})
  const [touched, setTouched] = useState<Partial<Record<keyof BookingFlowValues, boolean>>>({})
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedLeadId, setSubmittedLeadId] = useState<string | null>(null)
  const [submittedPayload, setSubmittedPayload] = useState<Partial<CreateLeadPayload> | null>(null)

  useEffect(() => {
    const storedDraft = window.localStorage.getItem(storageKey)
    let nextValues = requestSnapshot

    if (storedDraft) {
      try {
        nextValues = mergeBookingDraft(
          requestSnapshot,
          JSON.parse(storedDraft) as Partial<BookingFlowValues>,
        )
      } catch {
        nextValues = requestSnapshot
      }
    }

    setValues(nextValues)
    setErrors({})
    setTouched({})
    setCurrentStep(0)
    setStatusMessage(null)
    setSaveMessage(null)
    setSubmittedLeadId(null)
    setSubmittedPayload(null)
    setIsSubmitting(false)
    startedAtRef.current = Date.now()
    hasStartedAnalyticsRef.current = false
    lastFingerprintRef.current = null
  }, [requestSnapshot, storageKey])

  useEffect(() => {
    if (submittedPayload) return
    window.localStorage.setItem(storageKey, JSON.stringify(values))
  }, [storageKey, submittedPayload, values])

  const validateFields = (fields: Array<keyof BookingFlowValues>) => {
    const nextErrors: BookingFlowErrors = {}
    const validationValues = getValidationValues(values)

    for (const field of fields) {
      const error = validateBookingField(
        field as
          | "name"
          | "phone"
          | "email"
          | "preferredContact"
          | "eventType"
          | "location"
          | "eventDate"
          | "guestCount"
          | "budgetMin"
          | "budgetMax",
        String(validationValues[field]),
        validationValues,
      )

      if (error) {
        nextErrors[field] = error
      }
    }

    return nextErrors
  }

  const focusField = (field: keyof BookingFlowValues) => {
    const element = formRef.current?.querySelector<HTMLElement>(`[data-field="${field}"]`)
    element?.focus()
  }

  const updateField = <K extends keyof BookingFlowValues>(
    field: K,
    nextValue: BookingFlowValues[K],
  ) => {
    setValues((currentValues) => {
      const normalizedValue =
        field === "phone"
          ? (formatPhoneInput(String(nextValue)) as BookingFlowValues[K])
          : field === "budgetMin" || field === "budgetMax"
            ? (formatMoneyInput(String(nextValue)) as BookingFlowValues[K])
            : nextValue

      const nextValues = { ...currentValues, [field]: normalizedValue }

      if (touched[field] && field !== "packageLabel" && field !== "notes") {
        const validationValues = getValidationValues(nextValues)
        setErrors((currentErrors) => ({
          ...currentErrors,
          [field]: validateBookingField(
            field as
              | "name"
              | "phone"
              | "email"
              | "preferredContact"
              | "eventType"
              | "location"
              | "eventDate"
              | "guestCount"
              | "budgetMin"
              | "budgetMax",
            String(validationValues[field]),
            validationValues,
          ),
        }))
      }

      return nextValues
    })

    setStatusMessage(null)
    setSaveMessage(null)
  }

  const handleBlur = (field: keyof BookingFlowValues) => {
    setTouched((currentTouched) => ({ ...currentTouched, [field]: true }))

    if (field === "packageLabel" || field === "notes") {
      return
    }

    const validationValues = getValidationValues(values)
    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: validateBookingField(
        field as
          | "name"
          | "phone"
          | "email"
          | "preferredContact"
          | "eventType"
          | "location"
          | "eventDate"
          | "guestCount"
          | "budgetMin"
          | "budgetMax",
        String(validationValues[field]),
        validationValues,
      ),
    }))
  }

  const handleSaveDraft = () => {
    window.localStorage.setItem(storageKey, JSON.stringify(values))
    setSaveMessage("Saved on this device. You can come back later.")
  }

  const handleNext = () => {
    const stepErrors = validateFields(STEP_FIELDS[currentStep] ?? [])
    if (Object.keys(stepErrors).length > 0) {
      setErrors((currentErrors) => ({ ...currentErrors, ...stepErrors }))
      setTouched((currentTouched) => ({
        ...currentTouched,
        ...Object.fromEntries((STEP_FIELDS[currentStep] ?? []).map((field) => [field, true])),
      }))
      setStatusMessage("A few details still need your attention before you continue.")
      focusField((STEP_FIELDS[currentStep] ?? []).find((field) => stepErrors[field]) ?? "name")
      return
    }

    if (!hasStartedAnalyticsRef.current) {
      emitBookingEvent("onBookingStarted", {
        source: service?.slug ?? "booking",
        packageName: values.packageName || undefined,
      })
      hasStartedAnalyticsRef.current = true
    }

    setStatusMessage(null)
    setCurrentStep((step) => Math.min(step + 1, BOOKING_STEPS.length - 1))
  }

  const handleBack = () => {
    setStatusMessage(null)
    setCurrentStep((step) => Math.max(step - 1, 0))
  }

  const handleSubmit = async () => {
    const validationErrors = validateFields(STEP_FIELDS.flat())

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      setTouched(
        Object.fromEntries(
          STEP_FIELDS.flat().map((field) => [field, true]),
        ) as Partial<Record<keyof BookingFlowValues, boolean>>,
      )
      setStatusMessage("A few details still need your attention before you send this.")

      const firstInvalidField =
        STEP_FIELDS[0].find((field) => validationErrors[field]) ??
        STEP_FIELDS[1].find((field) => validationErrors[field]) ??
        STEP_FIELDS[2].find((field) => validationErrors[field])

      if (firstInvalidField) {
        const targetStep = STEP_FIELDS.findIndex((fields) => fields.includes(firstInvalidField))
        setCurrentStep(targetStep)
        window.setTimeout(() => focusField(firstInvalidField), 0)
      }

      return
    }

    if (values.website.trim()) {
      setStatusMessage("We could not verify this request. Please try again.")
      return
    }

    if (Date.now() - startedAtRef.current < MIN_BOOKING_FILL_MS) {
      setStatusMessage("Please take a moment to review your details before sending.")
      return
    }

    const payload = toLeadPayload(values)
    const fingerprint = JSON.stringify(payload)

    if (lastFingerprintRef.current === fingerprint) {
      setStatusMessage("This request is already in our queue. We will reach out shortly.")
      return
    }

    setIsSubmitting(true)
    setStatusMessage(null)

    emitBookingEvent("onBookingSubmitted", {
      eventType: payload.eventType,
      preferredContact: payload.preferredContact,
      location: payload.location,
      guestCount: payload.guestCount,
    })

    try {
      const response = await createLead(payload)
      lastFingerprintRef.current = fingerprint
      setSubmittedLeadId(response.id ?? null)
      setSubmittedPayload(payload)
      window.localStorage.removeItem(storageKey)
      emitBookingEvent("onBookingSuccess", {
        leadId: response.id,
        preferredContact: payload.preferredContact,
      })
    } catch (error) {
      const message = getFriendlyBookingError(error)
      setStatusMessage(message)
      emitBookingEvent("onBookingError", {
        message,
        code: error instanceof ApiError ? error.code : "UNKNOWN",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStartAnother = () => {
    window.localStorage.removeItem(storageKey)
    setValues(requestSnapshot)
    setErrors({})
    setTouched({})
    setCurrentStep(0)
    setStatusMessage(null)
    setSaveMessage(null)
    setSubmittedLeadId(null)
    setSubmittedPayload(null)
    startedAtRef.current = Date.now()
    hasStartedAnalyticsRef.current = false
    lastFingerprintRef.current = null
  }

  const formStatusCopy =
    statusMessage ??
    saveMessage ??
    "Secure, private, and no obligation."

  const compactResponseLabel = getCompactResponseLabel(service?.responseTime)
  const heroTrustSignals = [
    compactResponseLabel === "Fast reply" ? "Fast response" : `${compactResponseLabel} response`,
    "No payment today",
    "Private and secure",
  ]
  const footerTrustSignals = [
    "Private and secure",
    "No payment required today",
    service?.responseTime ?? "Reply within 30 minutes",
  ]
  const currentStepNumber = currentStep + 1
  const heroSecondaryLabel = service?.marketingPath ? "View service page" : "Back to homepage"
  const mobileSummaryPreview =
    [
      service?.shortLabel ?? "Custom request",
      values.guestCount ? `${values.guestCount} guests` : "",
      values.location.trim(),
    ]
      .filter(Boolean)
      .slice(0, 2)
      .join(" / ") || "Updates as you type"

  return (
    <BookingThemeScope className={styles.page} service={service?.slug}>
      <Navbar />

      <main className={styles.main}>
        <section className={styles.heroPanel}>
          <Image
            alt=""
            aria-hidden="true"
            className={styles.heroImage}
            fill
            priority
            sizes="(max-width: 719px) 100vw, 78rem"
            src={visual.heroImageSrc}
          />
          <div className={styles.heroOverlayBase} />
          <div className={styles.heroOverlayTheme} />
          <div className={styles.heroOverlayBottom} />
          <div className={styles.heroGrain} />
          <span className={`${styles.heroCorner} ${styles.heroCornerTL}`}>
            {visual.localeLabel}
          </span>
          <span className={`${styles.heroCorner} ${styles.heroCornerTR}`}>
            EST. 2026
          </span>
          <span className={`${styles.heroCorner} ${styles.heroCornerBL}`}>
            {visual.serviceLabel}
          </span>
          <span className={styles.heroRuleV} />

          <div className={styles.heroInner}>
            <div className={styles.heroGrid}>
              <div className={styles.heroPrimary}>
                <div className={styles.heroCopy}>
                  <div className={styles.heroKickerRow}>
                    <span className={styles.heroKickerLine} />
                    <p className={styles.eyebrow}>Private event concierge</p>
                    <span className={styles.heroKickerLine} />
                  </div>
                  <h1 className={styles.heroTitle}>{experience.heroTitle}</h1>
                  <div className={styles.heroRuleSep} aria-hidden="true">
                    <span className={styles.heroRuleH} />
                    <span className={styles.heroRuleDot} />
                    <span className={styles.heroRuleH} />
                  </div>
                  <p className={styles.heroDescription}>
                    {experience.heroDescription}
                  </p>
                  <p className={styles.heroTrustLine}>{experience.trustLine}</p>
                </div>

                <div className={styles.heroActions}>
                  <a href="#booking-form" className={styles.primaryHeroCta}>
                    Begin concierge brief
                  </a>
                  <Link
                    href={service?.marketingPath ?? "/"}
                    className={styles.secondaryHeroCta}
                  >
                    {heroSecondaryLabel}
                  </Link>
                </div>

                <div className={styles.trustRow}>
                  {heroTrustSignals.map((signal) => (
                    <span key={signal} className={styles.trustPill}>
                      {signal}
                    </span>
                  ))}
                </div>
              </div>

              <div className={styles.heroShowcase}>
                <div className={styles.serviceSwitchCard}>
                  <p className={styles.heroCardEyebrow}>Choose your service</p>
                  <div className={styles.serviceSwitch}>
                    {bookingServices.map((item) => (
                      <Link
                        key={item.slug}
                        href={`/booking/${item.slug}`}
                        className={`${styles.serviceLink} ${service?.slug === item.slug ? styles.serviceLinkActive : ""}`}
                      >
                        {item.shortLabel}
                      </Link>
                    ))}
                  </div>
                </div>

                <div className={styles.heroEditorialCard}>
                  <p className={styles.heroCardEyebrow}>The booking mood</p>
                  <h2 className={styles.spotlightTitle}>
                    {experience.moodLabel}
                  </h2>
                  <p className={styles.heroCardCopy}>{experience.moodCopy}</p>

                  <div className={styles.spotlightGrid}>
                    {experience.metrics.map((item) => (
                      <div key={item.label} className={styles.spotlightMetric}>
                        <span className={styles.spotlightLabel}>{item.label}</span>
                        <strong className={styles.spotlightValue}>{item.value}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.testimonialCard}>
                  <p className={styles.heroCardEyebrow}>Client note</p>
                  <p className={styles.testimonialQuote}>
                    &ldquo;{experience.testimonial.quote}&rdquo;
                  </p>
                  <div className={styles.testimonialMeta}>
                    <strong className={styles.testimonialName}>
                      {experience.testimonial.name}
                    </strong>
                    <span className={styles.testimonialContext}>
                      {experience.testimonial.context}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <ProgressBar currentStep={currentStep} />

        <div className={styles.layout}>
          <section id="booking-form" className={styles.contentPanel}>
            {submittedPayload ? (
              <div className={styles.successWrap}>
                <BookingSuccessPanel
                  leadId={submittedLeadId}
                  onStartAnother={handleStartAnother}
                  payload={submittedPayload}
                />
              </div>
            ) : (
              <form
                ref={formRef}
                className={styles.form}
                noValidate
                onSubmit={(event) => {
                  event.preventDefault()

                  if (currentStep < BOOKING_STEPS.length - 1) {
                    handleNext()
                    return
                  }

                  void handleSubmit()
                }}
              >
                <div className={styles.contentHeader}>
                  <div>
                    <p className={styles.sectionEyebrow}>Concierge brief</p>
                    <h2 className={styles.sectionTitle}>
                      Tell us a few essentials, and we will shape the rest.
                    </h2>
                  </div>
                  <p className={styles.sectionCopy}>
                    This is designed to feel like a premium planning handoff, not a cold form.
                    Private, quick, and no payment required today.
                  </p>
                </div>

                <input
                  aria-hidden="true"
                  autoComplete="off"
                  className={styles.honeypot}
                  suppressHydrationWarning
                  tabIndex={-1}
                  value={values.website}
                  onChange={(event) => updateField("website", event.target.value)}
                />

                <details className={styles.mobileSummaryShell}>
                  <summary className={styles.mobileSummaryToggle}>
                    <span className={styles.mobileSummaryLabelWrap}>
                      <strong className={styles.mobileSummaryTitle}>Live concierge preview</strong>
                      <span className={styles.mobileSummaryPreview}>{mobileSummaryPreview}</span>
                    </span>
                    <span className={styles.mobileSummaryAction}>Expand</span>
                  </summary>

                  <div className={styles.mobileSummaryBody}>
                    <BookingSummary service={service} values={values} />
                  </div>
                </details>

                <div key={currentStep} className={styles.stepFrame}>
                  {currentStep === 0 ? (
                    <StepContact
                      errors={errors}
                      onBlur={handleBlur}
                      onChange={(field, value) => updateField(field, value)}
                      values={values}
                    />
                  ) : null}

                  {currentStep === 1 ? (
                    <StepEvent
                      errors={errors}
                      onBlur={handleBlur}
                      onChange={(field, value) => updateField(field, value)}
                      values={values}
                    />
                  ) : null}

                  {currentStep === 2 ? (
                    <StepPreferences
                      errors={errors}
                      onBlur={handleBlur}
                      onChange={(field, value) => updateField(field, value)}
                      service={service}
                      values={values}
                    />
                  ) : null}

                  {currentStep === 3 ? (
                    <StepReview service={service} values={values} />
                  ) : null}
                </div>

                <div className={styles.footerBar}>
                  <div className={styles.statusBlock}>
                    <p className={styles.statusLine} aria-live="polite">
                      {formStatusCopy}
                    </p>
                    <p className={styles.statusHint}>
                      Step {currentStepNumber} of {BOOKING_STEPS.length} / {STEP_TIME_HINTS[currentStep]}
                    </p>
                  </div>

                  <div className={styles.footerActions}>
                    <button
                      type="button"
                      className={styles.utilityButton}
                      suppressHydrationWarning
                      onClick={handleSaveDraft}
                    >
                      Save for later
                    </button>

                    {currentStep > 0 ? (
                      <button
                        type="button"
                        className={styles.utilityButton}
                        suppressHydrationWarning
                        onClick={handleBack}
                      >
                        Back
                      </button>
                    ) : null}

                    <Button
                      className={styles.primaryCta}
                      loading={currentStep === BOOKING_STEPS.length - 1 ? isSubmitting : false}
                      size="lg"
                      suppressHydrationWarning
                      type="submit"
                    >
                      {STEP_CTA_LABELS[currentStep]}
                    </Button>
                  </div>

                  <div className={styles.footerTrust}>
                    {footerTrustSignals.map((signal) => (
                      <span key={signal} className={styles.footerTrustPill}>
                        {signal}
                      </span>
                    ))}
                  </div>
                </div>
              </form>
            )}
          </section>

          <aside className={styles.sidebar}>
            <BookingSummary service={service} values={values} />

            <div className={styles.helpCard}>
              <p className={styles.helpEyebrow}>Need a faster handoff?</p>
              <p className={styles.helpTitle}>Speak with our concierge team.</p>
              <p className={styles.helpCopy}>
                Call us if you want help shaping the brief while you book.
              </p>
              <div className={styles.helpMeta}>
                <span className={styles.helpMetaPill}>{compactResponseLabel} response</span>
                <span className={styles.helpMetaPill}>Private support</span>
              </div>
              <a href={supportHref} className={styles.helpLink}>
                Call concierge
              </a>
              <Link href="/booking" className={styles.helpLinkSecondary}>
                Start a different request
              </Link>
            </div>
          </aside>
        </div>
      </main>
    </BookingThemeScope>
  )
}
