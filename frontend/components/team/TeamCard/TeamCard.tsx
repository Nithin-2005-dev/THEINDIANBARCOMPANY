"use client"

import type { ReactNode } from "react"
import { getTeamInitials } from "@/lib/team"
import type { TeamMember } from "@/types/team"
import styles from "./TeamCard.module.css"

type TeamCardProps = {
  member: TeamMember
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3.5" />
      <path d="M8 10.2v6.2" />
      <path d="M8 7.8h.01" />
      <path d="M11.4 16.4v-3.5a2 2 0 0 1 4 0v3.5" />
      <path d="M11.4 10.2v6.2" />
    </svg>
  )
}

function WebsiteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M4.5 12h15" />
      <path d="M12 4c2.4 2.2 3.8 5 3.8 8s-1.4 5.8-3.8 8c-2.4-2.2-3.8-5-3.8-8S9.6 6.2 12 4Z" />
    </svg>
  )
}

function EmailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="6" width="16" height="12" rx="2.5" />
      <path d="m5.5 8.5 6.5 5 6.5-5" />
    </svg>
  )
}

function SocialLink({
  href,
  label,
  icon,
}: {
  href: string
  label: string
  icon: ReactNode
}) {
  const external = !href.startsWith("mailto:")

  return (
    <a
      href={href}
      className={styles.socialLink}
      aria-label={label}
      title={label}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
    >
      {icon}
      <span className={styles.socialLabel}>{label}</span>
    </a>
  )
}

export default function TeamCard({ member }: TeamCardProps) {
  const socialLinks = [
    member.instagramUrl
      ? { href: member.instagramUrl, label: "Instagram", icon: <InstagramIcon /> }
      : null,
    member.linkedInUrl
      ? { href: member.linkedInUrl, label: "LinkedIn", icon: <LinkedInIcon /> }
      : null,
    member.websiteUrl
      ? { href: member.websiteUrl, label: "Website", icon: <WebsiteIcon /> }
      : null,
    member.email
      ? { href: `mailto:${member.email}`, label: "Email", icon: <EmailIcon /> }
      : null,
  ].filter(Boolean) as Array<{ href: string; label: string; icon: ReactNode }>

  return (
    <article className={styles.card}>
      <div className={styles.photoShell}>
        {member.photoUrl ? (
          // Team photos come from runtime-defined Mongo documents, so the host is not fixed at build time.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={member.photoUrl} alt={`${member.name} portrait`} className={styles.photo} />
        ) : (
          <div className={styles.fallbackAvatar} aria-hidden="true">
            {getTeamInitials(member.name)}
          </div>
        )}
      </div>

      <div className={styles.content}>
        <h3 className={styles.name}>{member.name}</h3>
        <p className={styles.designation}>{member.designation}</p>

        {member.bio ? <p className={styles.bio}>{member.bio}</p> : null}

        {socialLinks.length ? (
          <div className={styles.socials}>
            {socialLinks.map((link) => (
              <SocialLink key={`${member.id}-${link.label}`} {...link} />
            ))}
          </div>
        ) : null}
      </div>
    </article>
  )
}
