"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import Button from "@/components/ui/Button"
import styles from "./Navbar.module.css"

export default function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className={styles.header}>

      <div className={styles.container}>

        {/* ===== LOGO ===== */}
        <Link href="/" className={styles.logo}>

          {/* LOGO IMAGE */}
          <Image
            src="/logo.png"   // or /logo.svg
            alt="TIB Logo"
            width={46}
            height={46}
            priority
            className={styles.logoImg}
          />

          {/* OPTIONAL TEXT */}
          <div className={styles.logoText}>
            <span className={styles.brand}>TIB</span>
            <span className={styles.tagline}>THE INDIAN BAR</span>
          </div>

        </Link>

        {/* ===== DESKTOP NAV ===== */}
        <nav className={styles.navDesktop}>
          <NavLink href="#tib">Experiences</NavLink>
          <NavLink href="#martini">House Parties</NavLink>
          <NavLink href="#negroni">Pool Parties</NavLink>
          <NavLink href="#cosmo">Corporate</NavLink>
          <NavLink href="#bloody-mary">Festivals</NavLink>
        </nav>

        {/* ===== ACTIONS ===== */}
        <div className={styles.actions}>

          <Button className={styles.cta}>
            Book Now
          </Button>

          <button
            className={styles.menuBtn}
            onClick={() => setOpen(!open)}
          >
            ☰
          </button>

        </div>

      </div>

      {/* ===== MOBILE MENU ===== */}
      {open && (
        <div className={styles.mobileMenu}>

          <MobileLink href="#tib">Experiences</MobileLink>
          <MobileLink href="#martini">House Parties</MobileLink>
          <MobileLink href="#negroni">Pool Parties</MobileLink>
          <MobileLink href="#cosmo">Corporate</MobileLink>
          <MobileLink href="#bloody-mary">Festivals</MobileLink>

          <Button className={styles.mobileCTA}>
            Book Now
          </Button>

        </div>
      )}

    </header>
  )
}

/* ===== LINK COMPONENTS ===== */

function NavLink({ href, children }: any) {
  return (
    <Link href={href} className={styles.navLink}>
      {children}
      <span className={styles.linkUnderline} />
    </Link>
  )
}

function MobileLink({ href, children }: any) {
  return (
    <Link href={href} className={styles.mobileLink}>
      {children}
    </Link>
  )
}