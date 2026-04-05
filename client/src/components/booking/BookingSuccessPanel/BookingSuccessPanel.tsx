"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useToast } from "@/components/dashboard/ToastProvider"
import Button from "@/components/ui/Button/Button"
import { getRoleLoginPath, getRolePendingAuthKey } from "@/lib/auth-routes"
import { showApiErrorToast } from "@/lib/api"
import { sendSharedLoginOtp } from "@/lib/login-auth"
import { buildWhatsAppUrl } from "@/lib/whatsapp"
import type { CreateLeadPayload } from "@/types/leads"
import styles from "./BookingSuccessPanel.module.css"

type BookingSuccessPanelProps = {
  leadId: string | null
  onStartAnother: () => void
  payload: Partial<CreateLeadPayload>
}

function getPreferredChannelLabel(value?: string) {
  if (value === "whatsapp") return "WhatsApp"
  if (value === "call") return "call"
  if (value === "email") return "email"
  return "your preferred channel"
}

function getAccountAccessMessage(payload: Partial<CreateLeadPayload>) {
  const email = payload.email?.trim()
  const phone = payload.phone?.trim()

  if (email && phone) {
    return `You can access your account anytime using ${email} or ${phone}.`
  }

  if (email) {
    return `You can access your account anytime using ${email}.`
  }

  if (phone) {
    return `You can access your account anytime using ${phone}.`
  }

  return "You can access your account anytime using the contact details shared in this request."
}

function getAccessDetails(payload: Partial<CreateLeadPayload>) {
  const details: Array<{ label: string; value: string }> = []

  if (payload.email?.trim()) {
    details.push({ label: "Email", value: payload.email.trim() })
  }

  if (payload.phone?.trim()) {
    details.push({ label: "Phone", value: payload.phone.trim() })
  }

  return details
}

function formatLeadReference(leadId: string | null) {
  if (!leadId) {
    return null
  }

  return leadId.slice(0, 8).toUpperCase()
}

export default function BookingSuccessPanel({
  leadId,
  onStartAnother,
  payload,
}: BookingSuccessPanelProps) {
  const router = useRouter()
  const { pushToast } = useToast()
  const [isOpeningDashboard, setIsOpeningDashboard] = useState(false)
  const whatsappUrl = buildWhatsAppUrl(payload)
  const preferredChannelLabel = getPreferredChannelLabel(payload.preferredContact)
  const dashboardIdentifier =
    payload.preferredContact === "email" && payload.email?.trim()
      ? payload.email.trim()
      : payload.phone?.trim() || payload.email?.trim() || null
  const accountAccessMessage = getAccountAccessMessage(payload)
  const accessDetails = getAccessDetails(payload)
  const referenceLabel = formatLeadReference(leadId)

  return (
    <section className={styles.root} aria-live="polite">
      <div className={styles.heroCard}>
        <div className={styles.heroTop}>
          <div className={styles.heroBadgeRow}>
            <span className={styles.orb} aria-hidden="true" />
            <div className={styles.badge}>Booking request received</div>
          </div>

          {referenceLabel ? (
            <div className={styles.referenceCard}>
              <span className={styles.referenceLabel}>Reference</span>
              <strong className={styles.referenceValue}>{referenceLabel}</strong>
            </div>
          ) : null}
        </div>

        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <h1 className={styles.title}>Thank you. Your concierge brief is now in review.</h1>
            <p className={styles.description}>
              Your request has been sent to The Indian Bar Company team. We will review the
              brief, confirm the best service fit, and reach out with the cleanest next step for
              your event.
            </p>

            <div className={styles.meta}>
              <span className={styles.metaItem}>Tailored quote guidance</span>
              <span className={styles.metaItem}>Private request handling</span>
              <span className={styles.metaItem}>No payment required today</span>
            </div>
          </div>

          <aside className={styles.responseCard}>
            <p className={styles.sectionEyebrow}>Expected response</p>
            <p className={styles.responseValue}>Within 30 minutes</p>
            <p className={styles.responseCopy}>
              During business hours, with follow-up on {preferredChannelLabel}.
            </p>
          </aside>
        </div>
      </div>

      <div className={styles.bodyGrid}>
        <article className={styles.timelineCard}>
          <div className={styles.cardHeader}>
            <p className={styles.sectionEyebrow}>What happens next</p>
            <h2 className={styles.cardTitle}>A clear handoff from request to planning.</h2>
            <p className={styles.cardCopy}>
              We keep the next steps tight so you know exactly what happens after submitting the
              brief.
            </p>
          </div>

          <div className={styles.timeline}>
            <div className={styles.timelineItem}>
              <span className={styles.timelineStep}>01</span>
              <div className={styles.timelineBody}>
                <p className={styles.timelineTitle}>Availability and service review</p>
                <p className={styles.timelineText}>
                  We check your date, venue, guest count, and service direction against current
                  availability.
                </p>
              </div>
            </div>

            <div className={styles.timelineItem}>
              <span className={styles.timelineStep}>02</span>
              <div className={styles.timelineBody}>
                <p className={styles.timelineTitle}>Tailored recommendation</p>
                <p className={styles.timelineText}>
                  Our concierge team shapes the right format, staffing, and budget lane for your
                  event.
                </p>
              </div>
            </div>

            <div className={styles.timelineItem}>
              <span className={styles.timelineStep}>03</span>
              <div className={styles.timelineBody}>
                <p className={styles.timelineTitle}>Direct follow-up and next actions</p>
                <p className={styles.timelineText}>
                  You receive the next step, proposal guidance, and account access details so the
                  booking can move forward smoothly.
                </p>
              </div>
            </div>
          </div>
        </article>

        <div className={styles.sideStack}>
          <aside className={styles.accessCard}>
            <div className={styles.cardHeader}>
              <p className={styles.sectionEyebrow}>Client dashboard</p>
              <h2 className={styles.cardTitle}>Access your request securely anytime.</h2>
              <p className={styles.cardCopy}>
                Sign in with the same contact details used in this booking. We will send a one-time
                verification code before opening your dashboard.
              </p>
            </div>

            {accessDetails.length ? (
              <div className={styles.accessGrid}>
                {accessDetails.map((detail) => (
                  <div key={`${detail.label}-${detail.value}`} className={styles.accessItem}>
                    <span className={styles.accessLabel}>{detail.label}</span>
                    <strong className={styles.accessValue}>{detail.value}</strong>
                  </div>
                ))}
              </div>
            ) : null}

            <p className={styles.accountAccess}>{accountAccessMessage}</p>

            <div className={styles.actions}>
              <Button
                block
                loading={isOpeningDashboard}
                size="lg"
                onClick={async () => {
                  try {
                    if (!dashboardIdentifier) {
                      router.push(getRoleLoginPath("CLIENT"))
                      return
                    }

                    setIsOpeningDashboard(true)
                    const data = await sendSharedLoginOtp("CLIENT", {
                      identifier: dashboardIdentifier,
                      name: payload.name,
                    })

                    sessionStorage.setItem(
                      getRolePendingAuthKey("CLIENT"),
                      JSON.stringify({
                        challengeId: data.challengeId,
                        identifier: dashboardIdentifier,
                        sentTo: data.sentTo,
                      }),
                    )

                    router.push(
                      `${getRoleLoginPath("CLIENT")}&step=verify&identifier=${encodeURIComponent(dashboardIdentifier)}`,
                    )
                  } catch (error) {
                    showApiErrorToast(
                      { pushToast },
                      error,
                      "Unable to open the client dashboard",
                    )
                  } finally {
                    setIsOpeningDashboard(false)
                  }
                }}
              >
                Access client dashboard
              </Button>

              <div className={styles.secondaryActions}>
                {whatsappUrl ? (
                  <a
                    className={styles.secondaryLink}
                    href={whatsappUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Continue on WhatsApp
                  </a>
                ) : null}

                <button type="button" className={styles.ghostButton} onClick={onStartAnother}>
                  Start another request
                </button>
              </div>
            </div>
          </aside>

          <aside className={styles.noteCard}>
            <p className={styles.sectionEyebrow}>Thank you</p>
            <h2 className={styles.cardTitle}>We appreciate the opportunity to support your event.</h2>
            <p className={styles.cardCopy}>
              Our team now has everything needed to prepare the next step with the right tone,
              pacing, and service direction for your brief.
            </p>

            <Link href="/" className={styles.backLink}>
              Back to site
            </Link>
          </aside>
        </div>
      </div>
    </section>
  )
}
