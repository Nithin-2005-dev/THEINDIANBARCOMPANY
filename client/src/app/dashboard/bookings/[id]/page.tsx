import EventDetailClient from "@/components/portal/EventDetailClient"

export default async function ClientBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <EventDetailClient eventId={id} />
}
