import styles from "./Provide.module.css"
import { provide } from "@/data/provide"

export default function Provide() {
  return (
    <section className={styles.section}>

      <div className={styles.header}>
        <h3 className={styles.kicker}>
          What We Provide
        </h3>

        <h2 className={styles.title}>
          Everything You Need For
          <br />
          A Perfect Celebration
        </h2>
      </div>

      <div className={styles.grid}>
        {provide.map((item, i) => (
          <div key={i} className={styles.card}>

            <div className={styles.number}>
              {(i + 1).toString().padStart(2, "0")}
            </div>

            <h3 className={styles.cardTitle}>
              {item.title}
            </h3>

            <p className={styles.desc}>
              {item.desc}
            </p>

          </div>
        ))}
      </div>

    </section>
  )
}