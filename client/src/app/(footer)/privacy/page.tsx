import type { Metadata } from "next"
import styles from "./privacy.module.css"
import { sections } from "@/data/privacysections"
import { buildMetadata } from "@/lib/seo"

export const metadata: Metadata = buildMetadata({
  title: "Privacy Policy",
  description:
    "Read the Privacy Policy for The Indian Bar to understand how we collect, use, protect, and manage your personal information.",
  path: "/privacy",
  keywords: [
    "privacy policy",
    "The Indian Bar privacy",
    "data protection policy",
  ],
})

export default function PrivacyPage() {
  return (
    <main className={styles.main}>

      {/* Bloom */}
      <div className={styles.bloom} />
      <div className={styles.bloomBottom} />

      {/* Vertical rule */}
      <span className={styles.ruleV} />

      {/* ── HERO ── */}
      <section className={styles.hero}>
        <span className={styles.kicker}>
          <span className={styles.kickerLine} />
          Legal
          <span className={styles.kickerLine} />
        </span>

        <h1 className={styles.heroTitle}>
          Privacy <em className={styles.titleEm}>Policy</em>
        </h1>

        <div className={styles.ruleSep}>
          <span className={styles.ruleH} />
          <span className={styles.ruleDot} />
          <span className={styles.ruleH} />
        </div>

        <p className={styles.heroSub}>
          Effective Date: 21 March 2026
        </p>

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

              {/* Number + title */}
              <div className={styles.sectionHead}>
                <span className={styles.sectionNum}>{s.number}</span>
                <h2 className={styles.sectionTitle}>{s.title}</h2>
              </div>

              <div className={styles.sectionBody}>

                {/* Intro text */}
                {s.content && (
                  <p className={styles.para}>{s.content}</p>
                )}

                {/* Service pills (section 01) */}
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

                {/* Top-level list */}
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

                {/* Subsections */}
                {s.subsections && (
                  <div className={styles.subsections}>
                    {s.subsections.map((sub) => (
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

                {/* Footer note */}
                {s.footer && (
                  <p className={styles.footNote}>{s.footer}</p>
                )}

              </div>

            </article>
          ))}

          {/* ── CONTACT CARD ── */}
          <article className={styles.contactCard}>
            <div className={styles.cardGlow} />
            <span className={styles.sectionNum}>12</span>
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
            <span className={styles.cardAccent} />
          </article>

          {/* ── CONSENT ── */}
          <div className={styles.consent}>
            <span className={styles.consentRule} />
            <p className={styles.consentText}>
              By using our website and services, you hereby consent to this Privacy Policy and agree to its terms.
            </p>
            <span className={styles.consentRule} />
          </div>

        </div>
      </section>

    </main>
  )
}
