import type { Metadata } from "next"
import styles from "./refund.module.css"
import { sections } from "@/data/refundsections"
import { buildMetadata } from "@/lib/seo"

export const metadata: Metadata = buildMetadata({
  title: "Refund Policy",
  description:
    "Review The Indian Bar refund and cancellation policy for bookings, rescheduling, advance payments, and refund processing timelines.",
  path: "/refund",
  keywords: [
    "refund policy",
    "cancellation policy",
    "The Indian Bar refunds",
  ],
})

export default function RefundPage() {
  return (
    <main className={styles.main}>

      <div className={styles.bloom} />
      <div className={styles.bloomBottom} />
      <span className={styles.ruleV} />

      {/* ── HERO ── */}
      <section className={styles.hero}>
        <span className={styles.kicker}>
          <span className={styles.kickerLine} />
          Legal
          <span className={styles.kickerLine} />
        </span>

        <h1 className={styles.heroTitle}>
          Refund <em className={styles.titleEm}>Policy</em>
        </h1>

        <div className={styles.ruleSep}>
          <span className={styles.ruleH} />
          <span className={styles.ruleDot} />
          <span className={styles.ruleH} />
        </div>

        <p className={styles.heroSub}>Effective Date: 21 March 2026</p>

        <div className={styles.heroMeta}>
          <span className={styles.metaItem}>The Indian Bar</span>
          <span className={styles.metaSep} />
          <span className={styles.metaItem}>TIB</span>
          <span className={styles.metaSep} />
          <span className={styles.metaItem}>India</span>
        </div>
      </section>

      {/* ── CONTENT ── */}
      <section className={styles.content}>
        <div className={styles.container}>

          {sections.map((s) => (
            <article key={s.number} className={styles.section}>

              <span className={styles.sectionNum}>{s.number}</span>

              <div className={styles.sectionInner}>
                <h2 className={styles.sectionTitle}>{s.title}</h2>

                <div className={styles.sectionBody}>

                  {s.content && (
                    <p className={styles.para}>{s.content}</p>
                  )}

                  {s.services && (
                    <div className={styles.pills}>
                      {s.services.map(srv => (
                        <div key={srv.name} className={styles.pill}>
                          <span className={styles.pillName}>{srv.name}</span>
                          <span className={styles.pillDesc}>{srv.desc}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Cancellation tiers (section 03) */}
                  {s.tiers && (
                    <div className={styles.tiers}>
                      {s.tiers.map(tier => (
                        <div
                          key={tier.label}
                          className={`${styles.tier} ${tier.danger ? styles.tierDanger : ""}`}
                        >
                          <div className={styles.tierHead}>
                            <span className={styles.tierLabel}>{tier.label}</span>
                            <span className={`${styles.tierTag} ${tier.danger ? styles.tierTagDanger : ""}`}>
                              {tier.tag}
                            </span>
                          </div>
                          <ul className={styles.list}>
                            {tier.items.map((item, i) => (
                              <li key={i} className={styles.listItem}>
                                <span className={styles.listDot} />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}

                  {s.items && (
                    <ul className={styles.list}>
                      {s.items.map((item, i) => (
                        <li key={i} className={styles.listItem}>
                          <span className={styles.listDot} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}

                  {s.footer && (
                    <p className={styles.footNote}>{s.footer}</p>
                  )}

                </div>
              </div>

            </article>
          ))}

          {/* ── CONTACT CARD ── */}
          <article className={styles.contactCard}>
            <div className={styles.cardGlow} />
            <span className={styles.sectionNum}>11</span>
            <div className={styles.sectionInner}>
              <h2 className={styles.sectionTitle}>Contact Information</h2>
              <div className={styles.contactGrid}>
                <div className={styles.contactItem}>
                  <span className={styles.contactLabel}>Organisation</span>
                  <span className={styles.contactValue}>The Indian Bar</span>
                </div>
                <div className={styles.contactItem}>
                  <span className={styles.contactLabel}>Email</span>
                  <a href="mailto:support@theindianbarcompany.com" className={styles.contactLink}>
                    support@theindianbarcompany.com
                  </a>
                </div>
                <div className={styles.contactItem}>
                  <span className={styles.contactLabel}>Phone</span>
                  <span className={styles.contactValue}>+91 78968 30724</span>
                </div>
                <div className={styles.contactItem}>
                  <span className={styles.contactLabel}>Phone</span>
                  <span className={styles.contactValue}>+91 81791 33593</span>
                </div>
              </div>
            </div>
            <span className={styles.cardAccent} />
          </article>

          {/* ── ACCEPTANCE ── */}
          <div className={styles.consent}>
            <span className={styles.consentRule} />
            <p className={styles.consentText}>
              By engaging the services of The Indian Bar, you acknowledge that you have read, understood, and agreed to this Refund Policy.
            </p>
            <span className={styles.consentRule} />
          </div>

        </div>
      </section>

    </main>
  )
}
