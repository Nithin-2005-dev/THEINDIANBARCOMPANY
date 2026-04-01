import StaffLeadDetailPage from "@/app/staff/leads/[id]/page"

export default async function StaffBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return <StaffLeadDetailPage params={params} />
}
