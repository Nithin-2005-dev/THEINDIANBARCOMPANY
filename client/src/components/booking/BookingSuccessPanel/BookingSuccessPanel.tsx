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

  return (
    <section className={styles.root} aria-live="polite">
      <div className={styles.hero}>
        <span className={styles.orb} aria-hidden="true" />
        <div className={styles.badge}>Request received</div>
      </div>

      <h1 className={styles.title}>Your event brief is with our concierge team.</h1>
      <p className={styles.description}>
        You are one step away from a tailored event plan. We usually reply within
        30 minutes during business hours, confirm availability, and recommend the
        cleanest next step for your event.
      </p>

      <div className={styles.meta}>
        <span className={styles.metaItem}>Fast follow-up</span>
        <span className={styles.metaItem}>No obligation</span>
        <span className={styles.metaItem}>Private request</span>
        {leadId ? <span className={styles.metaItem}>Reference {leadId}</span> : null}
      </div>

      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>What happens next</h2>
          <p className={styles.panelCopy}>
            A concierge specialist will contact you on {preferredChannelLabel} after
            the brief is reviewed.
          </p>
        </div>

        <div className={styles.timeline}>
          <div className={styles.timelineItem}>
            <span className={styles.timelineStep}>01</span>
            <div>
              <p className={styles.timelineTitle}>Availability review</p>
              <p className={styles.timelineText}>
                We check date, location, guest count, and service fit.
              </p>
            </div>
          </div>

          <div className={styles.timelineItem}>
            <span className={styles.timelineStep}>02</span>
            <div>
              <p className={styles.timelineTitle}>Tailored recommendation</p>
              <p className={styles.timelineText}>
                We suggest the right package lane, staffing, and budget direction.
              </p>
            </div>
          </div>

          <div className={styles.timelineItem}>
            <span className={styles.timelineStep}>03</span>
            <div>
              <p className={styles.timelineTitle}>Concierge follow-up</p>
              <p className={styles.timelineText}>
                We reach out with the next step, proposal details, and booking guidance.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <Button
          loading={isOpeningDashboard}
          onClick={async () => {
            try {
              if (!payload.phone) {
                router.push(getRoleLoginPath("CLIENT"))
                return
              }

              setIsOpeningDashboard(true)
              const data = await sendSharedLoginOtp("CLIENT", {
                identifier: payload.phone,
                name: payload.name,
              })

              sessionStorage.setItem(
                getRolePendingAuthKey("CLIENT"),
                JSON.stringify({
                  challengeId: data.challengeId,
                  identifier: payload.phone,
                  sentTo: data.sentTo,
                }),
              )

              router.push(
                `${getRoleLoginPath("CLIENT")}&step=verify&identifier=${encodeURIComponent(payload.phone)}`,
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
          size="lg"
        >
          Access client dashboard
        </Button>

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
    </section>
  )
}
