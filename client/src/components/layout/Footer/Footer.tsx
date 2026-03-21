"use client"

import styles from "./Footer.module.css"
import Link from "next/link"
import Image from "next/image"

const experiences = [
  { label: "House Parties",    href: "/martini"      },
  { label: "Pool Parties",     href: "/negroni"      },
  { label: "Corporate Events", href: "/cosmo"        },
  { label: "Festivals",        href: "/bloody-mary"  },
]

const company = [
  { label: "About Us",  href: "/about"   },
  { label: "Contact",   href: "/contact" },
  // { label: "Careers",   href: "/careers" },
  // { label: "Blog",      href: "/blog"    },
]

const legal = [
  { label: "Privacy Policy",   href: "/privacy" },
  { label: "Terms of Service", href: "/terms"   },
  { label: "Refund Policy",    href: "/refund"  },
]

const socials = [
  { label: "Instagram", href: "https://www.instagram.com/theindianbarcompany?igsh=ZjRheXRub2llb3Vn" },
  // { label: "LinkedIn",  href: "#" },
  // { label: "YouTube",   href: "#" },
]

export default function Footer() {
  return (
    <footer className={styles.footer}>

      {/* Ambient bloom */}
      <div className={styles.bloom} />

      {/* Top rule */}
      <div className={styles.ruleTop} />

      <div className={styles.container}>

        {/* ── TOP GRID ── */}
        <div className={styles.grid}>

          {/* BRAND */}
          <div className={styles.brand}>

            <div className={styles.logoRow}>
              <span className={styles.logoRing}>
                <Image
                  src="/logo.png"
                  alt="The Indian Bar"
                  width={18}
                  height={18}
                  className={styles.logo}
                />
              </span>
              <span className={styles.brandName}>THE INDIAN BAR</span>
            </div>

            <p className={styles.description}>
              Premium cocktail experiences crafted for private celebrations,
              corporate events, festivals, and luxury gatherings across India.
            </p>

            {/* Socials */}
            <div className={styles.socials}>
              {socials.map(s => (
                <a key={s.label} href={s.href} className={styles.socialLink}>
                  {s.label}
                </a>
              ))}
            </div>

          </div>

          {/* EXPERIENCES */}
          <div className={styles.col}>
            <h4 className={styles.heading}>
              <span className={styles.headingDot} />
              Experiences
            </h4>
            <ul className={styles.links}>
              {experiences.map(l => (
                <li key={l.href}>
                  <Link href={l.href} className={styles.link}>
                    <span className={styles.linkArrow}>→</span>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* COMPANY */}
          <div className={styles.col}>
            <h4 className={styles.heading}>
              <span className={styles.headingDot} />
              Company
            </h4>
            <ul className={styles.links}>
              {company.map(l => (
                <li key={l.href}>
                  <Link href={l.href} className={styles.link}>
                    <span className={styles.linkArrow}>→</span>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* LEGAL */}
          <div className={styles.col}>
            <h4 className={styles.heading}>
              <span className={styles.headingDot} />
              Legal
            </h4>
            <ul className={styles.links}>
              {legal.map(l => (
                <li key={l.href}>
                  <Link href={l.href} className={styles.link}>
                    <span className={styles.linkArrow}>→</span>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* CONTACT */}
          <div className={styles.col}>
            <h4 className={styles.heading}>
              <span className={styles.headingDot} />
              Contact
            </h4>
            <ul className={styles.contact}>
              <li className={styles.contactItem}>
                <span className={styles.contactLabel}>Email</span>
                <span className={styles.contactValue}>support@theindianbarcompany.com</span>
              </li>
              <li className={styles.contactItem}>
                <span className={styles.contactLabel}>Phone</span>
                <span className={styles.contactValue}>+91 7896830724</span>
              </li>
              <li className={styles.contactItem}>
                <span className={styles.contactLabel}>Cities</span>
                <span className={styles.contactValue}>· Delhi </span>
              </li>
            </ul>
          </div>

        </div>

        {/* ── DIVIDER ── */}
        <div className={styles.divider} />

        {/* ── BOTTOM BAR ── */}
        <div className={styles.bottom}>

          <div className={styles.bottomLeft}>
            <span className={styles.copyright}>
              © {new Date().getFullYear()} The Indian Bar
            </span>
            <span className={styles.bottomSep} />
            <span className={styles.bottomTagline}>All rights reserved</span>
          </div>

          <div className={styles.bottomLinks}>
            <Link href="/privacy"  className={styles.bottomLink}>Privacy</Link>
            <span className={styles.bottomDot} />
            <Link href="/terms"    className={styles.bottomLink}>Terms</Link>
            <span className={styles.bottomDot} />
            <Link href="/contact"  className={styles.bottomLink}>Support</Link>
          </div>

        </div>

      </div>

    </footer>
  )
}