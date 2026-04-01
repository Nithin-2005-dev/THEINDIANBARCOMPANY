type BackendGapNoticeProps = {
  title: string
  items: string[]
}

export default function BackendGapNotice({ title, items }: BackendGapNoticeProps) {
  return (
    <div className="rounded-[24px] border border-[#c6a86a]/20 bg-[#c6a86a]/8 p-4 text-sm text-[#f3e8bf]">
      <p className="font-medium">{title}</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-[#e8d9a6]/85">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
