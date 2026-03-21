import styles from "./Footer.module.css"
import Link from "next/link"
import Image from "next/image"

export default function Footer() {
  return (
    <footer className={styles.footer}>

      <div className={styles.container}>

        {/* ===== TOP GRID ===== */}

        <div className={styles.grid}>

          {/* BRAND */}
          <div className={styles.brand}>

            <div className={styles.logoRow}>
              <Image
                src="/logo.png"
                alt="The Indian Bar"
                width={44}
                height={44}
                className={styles.logo}
              />

              <span className={styles.brandName}>
                THE INDIAN BAR
              </span>
            </div>

            <p className={styles.description}>
              Premium cocktail experiences crafted for
              private celebrations, corporate events,
              festivals, and luxury gatherings across India.
            </p>

            <div className={styles.socials}>
              <a href="#">Instagram</a>
              <a href="#">LinkedIn</a>
              <a href="#">YouTube</a>
            </div>

          </div>

          {/* EXPERIENCES */}
          <div>
            <h4 className={styles.heading}>Experiences</h4>

            <ul className={styles.links}>
              <li><Link href="/martini">House Parties</Link></li>
              <li><Link href="/negroni">Pool Parties</Link></li>
              <li><Link href="/cosmo">Corporate Events</Link></li>
              <li><Link href="/bloody-mary">Festivals</Link></li>
            </ul>
          </div>

          {/* COMPANY */}
          <div>
            <h4 className={styles.heading}>Company</h4>

            <ul className={styles.links}>
              <li><Link href="/about">About Us</Link></li>
              <li><Link href="/contact">Contact</Link></li>
              <li><Link href="/careers">Careers</Link></li>
              <li><Link href="/blog">Blog</Link></li>
            </ul>
          </div>

          {/* LEGAL */}
          <div>
            <h4 className={styles.heading}>Legal</h4>

            <ul className={styles.links}>
              <li><Link href="/privacy">Privacy Policy</Link></li>
              <li><Link href="/terms">Terms of Service</Link></li>
              <li><Link href="/refund">Refund Policy</Link></li>
            </ul>
          </div>

          {/* CONTACT */}
          <div>
            <h4 className={styles.heading}>Contact</h4>

            <ul className={styles.contact}>
              <li>info@theindianbar.in</li>
              <li>+91 98765 43210</li>
              <li>Mumbai • Delhi • Bangalore • Goa</li>
            </ul>
          </div>

        </div>

        {/* ===== BOTTOM BAR ===== */}

        <div className={styles.bottom}>

          <div>
            © {new Date().getFullYear()} The Indian Bar. All rights reserved.
          </div>

          <div className={styles.bottomLinks}>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/contact">Support</Link>
          </div>

        </div>

      </div>

    </footer>
  )
}