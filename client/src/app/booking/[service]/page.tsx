import type { Metadata } from "next"
import { notFound } from "next/navigation"
import BookingShell from "@/components/booking/BookingShell/BookingShell"
import { resolveBookingService } from "@/components/booking/booking-service-config"
import { buildMetadata } from "@/lib/seo"

type BookingServicePageProps = {
  params: Promise<{
    service: string
  }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({
  params,
}: BookingServicePageProps): Promise<Metadata> {
  const { service } = await params
  const resolvedService = resolveBookingService(service)

  if (!resolvedService) {
    return buildMetadata({
      title: "Book your event",
      description:
        "Request availability for premium bartending and event bar services through The Indian Bar concierge booking flow.",
      path: "/booking",
    })
  }

  return buildMetadata({
    title: `${resolvedService.shortLabel} booking`,
    description: resolvedService.description,
    path: `/booking/${resolvedService.slug}`,
    image: "/images/martini/1.jpg",
  })
}

export default async function BookingServicePage({
  params,
  searchParams,
}: BookingServicePageProps) {
  const { service } = await params
  const resolvedSearchParams = await searchParams
  const resolvedService = resolveBookingService(service)

  if (!resolvedService) {
    notFound()
  }

  return (
    <BookingShell
      queryParams={resolvedSearchParams}
      serviceSlug={resolvedService.slug}
    />
  )
}
