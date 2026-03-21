import type { Metadata } from "next"
import styles from "./terms.module.css"
import { sections } from "@/data/termsections"
import { buildMetadata } from "@/lib/seo"

export const metadata: Metadata = buildMetadata({
  title: "Terms of Service",
  description:
    "Read the Terms of Service for The Indian Bar covering bookings, payments, cancellations, client responsibilities, and legal conditions.",
  path: "/terms",
  keywords: [
    "terms of service",
    "The Indian Bar terms",
    "event services terms",
  ],
})

export default function TermsPage() {
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
          Terms of <em className={styles.titleEm}>Service</em>
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

                  {s.subsections && (
                    <div className={styles.subsections}>
                      {s.subsections.map(sub => (
                        <div key={sub.label} className={styles.sub}>
                          <h3 className={styles.subLabel}>{sub.label}</h3>
                          <ul className={styles.list}>
                            {sub.items.map((item, i) => (
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
            <span className={styles.sectionNum}>18</span>
            <div className={styles.sectionInner}>
              <h2 className={styles.sectionTitle}>Contact Information</h2>
              <div className={styles.contactGrid}>
                <div className={styles.contactItem}>
                  <span className={styles.contactLabel}>Organisation</span>
                  <span className={styles.contactValue}>The Indian Bar</span>
                </div>
                <div className={styles.contactItem}>
                  <span className={styles.contactLabel}>Email</span>
                  <a href="mailto:support@theindianbar.com" className={styles.contactLink}>
                    support@theindianbar.com
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
              By engaging the services of The Indian Bar, you acknowledge that you have read, understood, and agreed to these Terms of Service.
            </p>
            <span className={styles.consentRule} />
          </div>

        </div>
      </section>

    </main>
  )
}
