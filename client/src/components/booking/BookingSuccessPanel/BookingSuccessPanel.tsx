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
  if (value === "call") return "phone"
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
        <div className={styles.heroHeader}>
          <div className={styles.heroBadgeRow}>
            <span className={styles.orb} aria-hidden="true" />
            <div className={styles.badge}>Booking request received</div>
          </div>

          {referenceLabel ? (
            <div className={styles.referencePill}>Ref {referenceLabel}</div>
          ) : null}
        </div>

        <div className={styles.heroBody}>
          <div className={styles.heroCopy}>
            <h1 className={styles.title}>Your booking request is in.</h1>
            <p className={styles.description}>
              We have your brief and will review the date, venue, guest count, and service fit
              before reaching out via {preferredChannelLabel}.
            </p>
          </div>

          <div className={styles.heroMeta}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Response</span>
              <strong className={styles.metaValue}>Within 30 minutes</strong>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Payment</span>
              <strong className={styles.metaValue}>Not required today</strong>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Access</span>
              <strong className={styles.metaValue}>Secure client dashboard</strong>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.contentGrid}>
        <article className={styles.stepsCard}>
          <div className={styles.cardHeader}>
            <p className={styles.sectionEyebrow}>Next steps</p>
            <h2 className={styles.cardTitle}>What happens now</h2>
            <p className={styles.cardCopy}>
              A quick handoff, then a tailored recommendation for your event.
            </p>
          </div>

          <div className={styles.stepList}>
            <div className={styles.stepItem}>
              <span className={styles.stepNumber}>01</span>
              <div className={styles.stepBody}>
                <p className={styles.stepTitle}>Availability review</p>
                <p className={styles.stepText}>
                  We check your date, venue, guest count, and service fit.
                </p>
              </div>
            </div>

            <div className={styles.stepItem}>
              <span className={styles.stepNumber}>02</span>
              <div className={styles.stepBody}>
                <p className={styles.stepTitle}>Recommendation</p>
                <p className={styles.stepText}>
                  We shape the right setup, staffing plan, and budget lane.
                </p>
              </div>
            </div>

            <div className={styles.stepItem}>
              <span className={styles.stepNumber}>03</span>
              <div className={styles.stepBody}>
                <p className={styles.stepTitle}>Follow-up</p>
                <p className={styles.stepText}>
                  We reach out via {preferredChannelLabel} with the cleanest next step.
                </p>
              </div>
            </div>
          </div>
        </article>

        <aside className={styles.accessCard}>
          <div className={styles.cardHeader}>
            <p className={styles.sectionEyebrow}>Client dashboard</p>
            <h2 className={styles.cardTitle}>Track this request securely.</h2>
            <p className={styles.cardCopy}>
              Sign in with the same email or phone used in this request. We send a one-time code
              before opening your dashboard.
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
                      resendAvailableAt: data.resendAvailableAt,
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
              Open client dashboard
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

            <Link href="/" className={styles.backLink}>
              Back to site
            </Link>
          </div>
        </aside>
      </div>
    </section>
  )
}
