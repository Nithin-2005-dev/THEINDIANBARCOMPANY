import LeadDetailClient from "@/app/admin/leads/[id]/page.client"

export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <LeadDetailClient id={id} />
}
