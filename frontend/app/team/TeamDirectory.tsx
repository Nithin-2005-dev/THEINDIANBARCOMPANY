"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import TeamCard from "@/components/team/TeamCard/TeamCard"
import { TEAM_CATEGORIES, getTeamCategoryLabel, sortTeamMembers } from "@/lib/team"
import type { TeamCategory, TeamMember } from "@/types/team"
import styles from "./page.module.css"

const CATEGORY_CONTENT: Record<
  TeamCategory,
  {
    index: string
    sectionLabel: string
    heading: string
    summary: string
  }
> = {
  CORE: {
    index: "01",
    sectionLabel: "Core Team",
    heading: "Leadership and operators shaping every brief, pour, and guest-facing detail.",
    summary:
      "The core team leads planning, hospitality standards, execution quality, and client relationships across The Bartenders.",
  },
  TRUSTEE: {
    index: "02",
    sectionLabel: "Trustee Network",
    heading: "Strategic advisors and long-term partners bringing structure, judgment, and trust to the brand.",
    summary:
      "Trustees bring perspective across business, culture, and long-horizon growth to keep the brand disciplined and credible.",
  },
  INFLUENCERS: {
    index: "03",
    sectionLabel: "Influencer Partners",
    heading: "Public-facing collaborators extending the brand across culture, hospitality, and audience reach.",
    summary:
      "Influencer partners help translate The Bartenders into conversations, communities, and collaborations that feel current and considered.",
  },
}

type TeamDirectoryProps = {
  members: TeamMember[]
}

export default function TeamDirectory({ members }: TeamDirectoryProps) {
  const [activeCategory, setActiveCategory] = useState<TeamCategory>("CORE")
  const sortedMembers = useMemo(() => sortTeamMembers(members), [members])
  const groupedMembers = useMemo(
    () =>
      TEAM_CATEGORIES.reduce<Record<TeamCategory, TeamMember[]>>(
        (accumulator, category) => {
          accumulator[category] = sortedMembers.filter((member) => member.category === category)
          return accumulator
        },
        {
          CORE: [],
          TRUSTEE: [],
          INFLUENCERS: [],
        },
      ),
    [sortedMembers],
  )

  const activeMembers = groupedMembers[activeCategory]
  const totalMembers = sortedMembers.length
  const activeContent = CATEGORY_CONTENT[activeCategory]

  return (
    <main className={styles.page}>
      <header className="siteHeader">
        <Link href="/" className="siteLogo">
          the<span style={{ color: "var(--tib-accent)" }}>indian</span>bar
        </Link>
        <Link href="/" className="headerContact">
          Home
        </Link>
      </header>

      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <p className={styles.sidebarEyebrow}>Team Sections</p>

          <div className={styles.sidebarNav} role="tablist" aria-label="Team categories">
            {TEAM_CATEGORIES.map((category, index) => {
              const active = category === activeCategory
              return (
                <button
                  key={category}
                  id={`team-tab-${category.toLowerCase()}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`team-panel-${category.toLowerCase()}`}
                  className={`${styles.sidebarTab} ${active ? styles.sidebarTabActive : ""}`}
                  onClick={() => setActiveCategory(category)}
                >
                  <span className={styles.sidebarTabMain}>
                    <span className={styles.sidebarIndex}>{String(index + 1).padStart(2, "0")}</span>
                    <span className={styles.sidebarLabel}>{getTeamCategoryLabel(category)}</span>
                  </span>
                  <span className={styles.sidebarCount}>
                    {String(groupedMembers[category].length).padStart(2, "0")}
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        <section className={styles.content}>
          <div className={styles.mobileSwitcherWrap}>
            <p className={styles.mobileSwitcherHeading}>Team Sections</p>

            <div className={styles.mobileSwitcher} role="tablist" aria-label="Team categories">
              {TEAM_CATEGORIES.map((category, index) => {
                const active = category === activeCategory
                return (
                  <button
                    key={category}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`${styles.mobileTab} ${active ? styles.mobileTabActive : ""}`}
                    onClick={() => setActiveCategory(category)}
                  >
                    <span className={styles.mobileTabIndex}>{String(index + 1).padStart(2, "0")}</span>
                    <span className={styles.mobileTabLabel}>{getTeamCategoryLabel(category)}</span>
                    <span className={styles.mobileTabCount}>
                      {String(groupedMembers[category].length).padStart(2, "0")}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <header className={styles.hero}>
            <div className={styles.heroTop}>
              <p className={styles.kicker}>
                <span className={styles.kickerDot} />
                Team
              </p>
              <span className={styles.heroRule} aria-hidden="true" />
            </div>

            <div className={styles.heroGrid}>
              <div className={styles.heroCopy}>
                <h1 className={styles.title}>Built by the people behind The Bartenders experience.</h1>
              </div>

              <div className={styles.heroMeta}>
                <p className={styles.heroMetaIndex}>{activeContent.index}</p>
                <p className={styles.description}>{activeContent.summary}</p>

                <div className={styles.facts}>
                  <div className={styles.fact}>
                    <strong>{String(totalMembers).padStart(2, "0")}</strong>
                    <span>Total published profiles</span>
                  </div>
                  <div className={styles.fact}>
                    <strong>{String(activeMembers.length).padStart(2, "0")}</strong>
                    <span>{getTeamCategoryLabel(activeCategory)} members</span>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <section
            id={`team-panel-${activeCategory.toLowerCase()}`}
            role="tabpanel"
            aria-labelledby={`team-tab-${activeCategory.toLowerCase()}`}
            className={styles.panel}
          >
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.sectionEyebrow}>{activeContent.sectionLabel}</p>
                <h2 className={styles.sectionTitle}>{activeContent.heading}</h2>
              </div>

              <p className={styles.sectionNote}>The Bartenders (Team)</p>
            </div>

            {activeMembers.length ? (
              <div className={styles.stage}>
                <div className={styles.membersGrid}>
                  {activeMembers.map((member) => (
                    <TeamCard key={member.id} member={member} />
                  ))}
                </div>
              </div>
            ) : (
              <p className={styles.emptyNote}>Profiles for this section will be published soon.</p>
            )}
          </section>
        </section>
      </div>
    </main>
  )
}
