"use client"

import styles from "./ServiceTiles.module.css"
import { services } from "@/data/services"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

/* ─── CINEMATIC TRANSITION ─── */

function CinematicTransition({
  service,
  originRect,
  onComplete,
}: {
  service: typeof services[0]
  originRect: DOMRect | null
  onComplete: () => void
}) {
  const [phase, setPhase] = useState<"ink" | "reveal" | "seal">("ink")
  const letters = service.name.split("")

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("reveal"), 480)
    const t2 = setTimeout(() => setPhase("seal"),   2000)
    const t3 = setTimeout(() => onComplete(),        2500)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onComplete])

  const ox = originRect ? Math.round((originRect.left + originRect.width  / 2) / window.innerWidth  * 100) : 50
  const oy = originRect ? Math.round((originRect.top  + originRect.height / 2) / window.innerHeight * 100) : 50

  return (
    <motion.div
      className={styles.portal}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeIn" }}
    >

      {/* ── LAYER 1: INK FLOOD ── */}
      <motion.div
        className={styles.inkFlood}
        initial={{ clipPath: `circle(0% at ${ox}% ${oy}%)` }}
        animate={{ clipPath: `circle(150% at ${ox}% ${oy}%)` }}
        transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }}
      />

      {/* ── LAYER 2: VIDEO ── */}
      <AnimatePresence>
        {phase !== "ink" && (
          <motion.div
            className={styles.portalVideoWrap}
            initial={{ opacity: 0, scale: 1.06, filter: "saturate(0) brightness(0.3)" }}
            animate={{ opacity: 1, scale: 1,    filter: "saturate(1.1) brightness(1)" }}
            transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <video className={styles.portalVideo} autoPlay muted loop playsInline>
              <source src={service.video} type="video/mp4" />
            </video>
            <div className={styles.portalVignette} />
            <motion.div
              className={styles.scanline}
              initial={{ top: "-4%" }}
              animate={{ top: "104%" }}
              transition={{ duration: 1.1, ease: "linear", delay: 0.05 }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LAYER 3: TYPOGRAPHY ── */}
      <AnimatePresence>
        {phase === "reveal" && (
          <div className={styles.portalType}>

            <motion.span
              className={styles.portalKicker}
              initial={{ opacity: 0, letterSpacing: "0.5em" }}
              animate={{ opacity: 1, letterSpacing: "0.22em" }}
              transition={{ duration: 0.55, delay: 0.1, ease: "easeOut" }}
            >
              {service.tag}
            </motion.span>

            <div className={styles.portalName} aria-label={service.name}>
              {letters.map((char, i) => (
                <motion.span
                  key={i}
                  className={styles.portalLetter}
                  initial={{ opacity: 0, y: 40, rotateX: -60 }}
                  animate={{ opacity: 1, y: 0,  rotateX: 0  }}
                  transition={{
                    duration: 0.65,
                    delay: 0.18 + i * 0.072,
                    ease: [0.22, 0.61, 0.36, 1],
                  }}
                >
                  {char === " " ? "\u00A0" : char}
                </motion.span>
              ))}
            </div>

            <motion.div
              className={styles.portalSubline}
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "100%" }}
              transition={{ duration: 0.9, delay: 0.7, ease: "easeOut" }}
            />

          </div>
        )}
      </AnimatePresence>

      {/* ── LAYER 4: SEAL ── */}
      <AnimatePresence>
        {phase === "seal" && (
          <motion.div
            className={styles.seal}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.45, ease: [0.76, 0, 0.24, 1] }}
          />
        )}
      </AnimatePresence>

    </motion.div>
  )
}

/* ─── MAIN COMPONENT ─── */

export default function ServiceTiles() {
  const router = useRouter()
  const [active, setActive]           = useState<string | null>(null)
  const [originRect, setOriginRect]   = useState<DOMRect | null>(null)

  const handleClick = (id: string, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    setOriginRect(rect)
    setActive(id)
  }

  const handleComplete = () => {
    router.push(`/${active}`)
  }

  const activeService = services.find(s => s.id === active)

  return (
    <section id="services" className={styles.section}>

      {/* HEADER */}
      <div className={styles.header}>
        <h3 className={styles.kicker}>Experiences</h3>
        <h2 className={styles.title}>Our Signature Services</h2>
      </div>

      {/* GRID */}
      <div className={styles.grid}>
        {services.map(service => (
          <motion.div
            key={service.id}
            className={styles.card}
            onClick={e => handleClick(service.id, e)}
            whileHover={{ y: -12, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <video className={styles.video} autoPlay muted loop playsInline>
              <source src={service.video} type="video/mp4" />
            </video>
            <div className={styles.overlay} />
            <div className={styles.content}>
              <div className={styles.tag}>{service.tag}</div>
              <div className={styles.brand}>{service.name}</div>
              <h3 className={styles.titleCard}>{service.title}</h3>
              <p className={styles.description}>{service.description}</p>
            </div>
            <div className={styles.arrow}>→</div>
          </motion.div>
        ))}
      </div>

      {/* CINEMATIC TRANSITION */}
      <AnimatePresence>
        {activeService && (
          <CinematicTransition
            key={active}
            service={activeService}
            originRect={originRect}
            onComplete={handleComplete}
          />
        )}
      </AnimatePresence>

    </section>
  )
}
