export const siteConfig = {
  name: "The Indian Bar Company",
  shortName: "TIB",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  description:
    "Luxury bartending services in India for house parties, pool parties, corporate events, festivals, and after-dark celebrations.",
  keywords: [
    "bartending services India",
    "luxury bartending India",
    "private bartenders for parties",
    "cocktail catering India",
    "event bartending services",
    "house party bartenders",
    "pool party bartenders",
    "corporate event bartenders",
    "festival bar service",
    "after party bartenders",
    "premium cocktail experiences",
    "The Indian Bar Company",
  ],
  ogImage: "/tib.png",
} as const

export function absoluteUrl(path = "/") {
  return new URL(path, siteConfig.siteUrl).toString()
}
