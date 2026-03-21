import styles from "./ServiceTiles.module.css"
import { services } from "@/data/services"
import Link from "next/link"

export default function ServiceTiles() {
  return (
    <section className={styles.section}>

      <div className={styles.header}>
        <h3 className={styles.kicker}>Experiences</h3>
        <h2 className={styles.title}>Our Signature Services</h2>
      </div>

      <div className={styles.grid}>
        {services.map(service => (
          <Link
            key={service.id}
            href={`/${service.id}`}
            className={styles.card}
          >

            {/* VIDEO */}
            <video
              className={styles.video}
              autoPlay
              muted
              loop
              playsInline
            >
              <source src={service.video} type="video/mp4" />
            </video>

            {/* OVERLAY */}
            <div className={styles.overlay} />

            {/* TEXT CONTENT */}
            <div className={styles.content}>

              <div className={styles.tag}>
                {service.tag}
              </div>

              <div className={styles.brand}>
                {service.name}
              </div>

              <h3 className={styles.titleCard}>
                {service.title}
              </h3>

              <p className={styles.description}>
                {service.description}
              </p>

            </div>

            {/* ARROW CTA */}
            <div className={styles.arrow}>
              →
            </div>

          </Link>
        ))}
      </div>

    </section>
  )
}