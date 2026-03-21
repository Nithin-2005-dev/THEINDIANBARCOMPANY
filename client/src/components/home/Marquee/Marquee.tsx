"use client"

import { useEffect, useRef } from "react"
import styles from "./Marquee.module.css"

export default function Marquee() {
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY

      if (trackRef.current) {
        trackRef.current.style.transform =
          `translate3d(${-y * 0.4}px, 0, 0)`
      }
    }

    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <section className={styles.section}>
      <div className={styles.wrapper}>
        <div ref={trackRef} className={styles.track}>
          ✦ LUXURY EXPERIENCE ✦ VIP PARTIES ✦ PREMIUM EVENTS ✦ CELEBRATIONS ✦
          ✦ LUXURY EXPERIENCE ✦ VIP PARTIES ✦ PREMIUM EVENTS ✦ CELEBRATIONS ✦
        </div>
      </div>
    </section>
  )
}