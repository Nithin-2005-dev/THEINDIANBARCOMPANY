import styles from "./Hero.module.css"
import Image from "next/image"
import Button from "@/components/ui/Button"

export default function Hero() {
  return (
    <section className={styles.hero}>

      {/* VIDEO BACKGROUND */}
      <video
        className={styles.video}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      >
        <source src="/videos/party.mp4" type="video/mp4" />
      </video>

      {/* CINEMATIC OVERLAY */}
      <div className={styles.overlay} />

      {/* CENTER CONTENT */}
      <div className={styles.center}>

        {/* LUXURY EMBLEM */}
        <div className={styles.emblemWrap}>
          <Image
            src="/images/cocktail.png"
            alt="Cocktail"
            width={150}
            height={150}
            priority
            className={styles.emblem}
          />
        </div>

        <div className={styles.logo}>TIB</div>

        <h1 className={styles.title}>
          Elevate Your Party Experience
        </h1>

        <p className={styles.subtitle}>
          Premium cocktail experiences curated for unforgettable celebrations.
        </p>

        <div className={styles.buttons}>
          <Button>Explore Packages</Button>

          <button className={styles.secondaryBtn}>
            Book Now
          </button>
        </div>

      </div>

      {/* SCROLL INDICATOR */}
      <div className={styles.scrollIndicator}>
        <span />
      </div>

    </section>
  )
}