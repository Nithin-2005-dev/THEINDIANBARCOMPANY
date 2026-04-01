import EventDetailClient from "@/components/portal/EventDetailClient"

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <EventDetailClient eventId={id} />
}
