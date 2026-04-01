import type { Metadata } from "next"
import BookingShell from "@/components/booking/BookingShell/BookingShell"
import { buildMetadata } from "@/lib/seo"

export const metadata: Metadata = buildMetadata({
  title: "Book your event",
  description:
    "Request availability for house parties, pool parties, corporate events, and festival bar services through The Indian Bar concierge booking flow.",
  path: "/booking",
  keywords: [
    "event booking India",
    "bartender booking",
    "cocktail catering booking",
    "premium event consultation",
  ],
  image: "/images/martini/1.jpg",
})

type BookingPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function BookingPage({ searchParams }: BookingPageProps) {
  const resolvedSearchParams = await searchParams

  return <BookingShell queryParams={resolvedSearchParams} />
}
