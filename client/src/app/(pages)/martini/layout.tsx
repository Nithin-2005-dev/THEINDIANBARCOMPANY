export default function MartiniLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="theme-martini">
      {children}
    </div>
  )
}