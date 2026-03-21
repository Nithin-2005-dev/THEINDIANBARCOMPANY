import styles from "./Cities.module.css"
import { cities } from "@/data/cities"

export default function Cities() {
  // Duplicate list for infinite scroll illusion
  const extended = [...cities, ...cities]

  return (
    <section className={styles.section}>

      <h3 className={styles.heading}>
        Explore Cities
      </h3>

      <div className={styles.wrapper}>

        <div className={styles.track}>
          {extended.map((city, i) => (
            <div key={i} className={styles.pill}>
              {city}
            </div>
          ))}
        </div>

      </div>

    </section>
  )
}