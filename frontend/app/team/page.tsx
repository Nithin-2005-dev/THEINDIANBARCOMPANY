import type { Metadata } from "next"
import TeamDirectory from "./TeamDirectory"
import { absoluteUrl } from "@/lib/seo"
import { getPublishedTeamMembers } from "@/lib/team-store"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "The Bartenders Team",
  description:
    "Meet the leadership, trustees, and influencer partners behind The Indian Bar Company's premium bartending experiences.",
  keywords: [
    "The Indian Bar Company team",
    "bartending team India",
    "event hospitality leadership",
    "luxury bartending team",
    "cocktail experts India",
    "hospitality operations team",
  ],
  alternates: {
    canonical: "/team",
  },
  openGraph: {
    type: "website",
    url: absoluteUrl("/team"),
    title: "The Bartenders Team | The Indian Bar Company",
    description:
      "Meet the leadership, trustees, and influencer partners behind The Indian Bar Company's premium bartending experiences.",
    images: [
      {
        url: "/services/martini.jpeg",
        alt: "The Indian Bar Company team page",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Bartenders Team | The Indian Bar Company",
    description:
      "Meet the leadership, trustees, and influencer partners behind The Indian Bar Company's premium bartending experiences.",
    images: ["/services/martini.jpeg"],
  },
}

export default async function TeamPage() {
  const members = await getPublishedTeamMembers()

  return <TeamDirectory members={members} />
}
