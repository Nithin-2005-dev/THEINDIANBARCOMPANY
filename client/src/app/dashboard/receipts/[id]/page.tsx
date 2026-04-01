import PortalShell from "@/components/portal/PortalShell"

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <PortalShell>
      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <div className="rounded-[32px] border border-white/10 bg-white/[0.05] p-8 backdrop-blur-xl">
          <p className="text-[10px] uppercase tracking-[0.34em] text-[#d4af37]">Receipt Reference</p>
          <h1 className="mt-4 font-serif text-4xl text-white/95">Payment receipt</h1>
          <p className="mt-4 text-sm leading-7 text-white/58">
            Receipt reference <span className="text-white/88">{id}</span>. This payment has been recorded in your event ledger and can be used as your immediate acknowledgment.
          </p>
        </div>
      </main>
    </PortalShell>
  )
}
