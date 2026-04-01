import { themeStyles } from "@/lib/theme"

export default function MartiniLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div style={themeStyles.bm}>
      {children}
    </div>
  )
}
