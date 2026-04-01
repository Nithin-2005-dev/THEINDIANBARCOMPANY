import LeadDetailClient from "./page.client"

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <LeadDetailClient id={id} />
}
