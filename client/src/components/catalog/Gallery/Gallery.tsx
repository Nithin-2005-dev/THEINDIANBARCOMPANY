"use client"

import styles from "./Gallery.module.css"
import { useState } from "react"

type GalleryProps = {
  title: string
  subtitle: string
  images: string[]
}

export default function Gallery({ title, subtitle, images }: GalleryProps) {
  const [lightbox, setLightbox] = useState<number | null>(null)

  const close = () => setLightbox(null)

  const prev = () =>
    setLightbox(i => (i === null ? null : (i - 1 + images.length) % images.length))

  const next = () =>
    setLightbox(i => (i === null ? null : (i + 1) % images.length))

  return (
    <section className={styles.section}>

      {/* Ambient bloom */}
      <div className={styles.bloom} />

      {/* HEADER */}
      <div className={styles.header}>
        <span className={styles.kicker}>
          <span className={styles.kickerLine} />
          Gallery
          <span className={styles.kickerLine} />
        </span>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>

      {/* GRID */}
      <div className={styles.grid}>
        {images.map((src, i) => (
          <div
            key={i}
            className={styles.card}
            onClick={() => setLightbox(i)}
          >
            <img src={src} alt={`Experience ${i + 1}`} loading="lazy" />

            {/* Gradient */}
            <div className={styles.cardOverlay} />

            {/* Index label */}
            <span className={styles.cardIndex}>
              {String(i + 1).padStart(2, "0")}
            </span>

            {/* Expand icon */}
            <span className={styles.expandIcon}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 2h4v4M6 14H2v-4M14 2l-5 5M2 14l5-5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>

            {/* Bottom accent line */}
            <span className={styles.cardAccent} />
          </div>
        ))}
      </div>

      {/* LIGHTBOX */}
      {lightbox !== null && (
        <div className={styles.lightbox} onClick={close}>

          <div className={styles.lightboxInner} onClick={e => e.stopPropagation()}>

            <img
              src={images[lightbox]}
              alt={`Experience ${lightbox + 1}`}
              className={styles.lightboxImg}
            />

            {/* Vignette */}
            <div className={styles.lightboxVignette} />

            {/* Counter */}
            <span className={styles.lightboxCounter}>
              {String(lightbox + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
            </span>

            {/* Close */}
            <button className={styles.closeBtn} onClick={close} aria-label="Close">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>

            {/* Prev */}
            <button className={`${styles.navBtn} ${styles.navPrev}`} onClick={prev} aria-label="Previous">
              <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
                <path d="M9 1L1 8l8 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Next */}
            <button className={`${styles.navBtn} ${styles.navNext}`} onClick={next} aria-label="Next">
              <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
                <path d="M1 1l8 7-8 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

          </div>

        </div>
      )}

    </section>
  )
}