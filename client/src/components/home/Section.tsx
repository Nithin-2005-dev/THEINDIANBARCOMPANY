type Props = {
  id: string
  theme: string
  title: string
  subtitle: string
  children?: React.ReactNode
}

export default function Section({
  id,
  theme,
  title,
  subtitle,
  children,
}: Props) {
  return (
    <section
      id={id}
      className={`${theme} py-20 md:py-24 px-6 bg-(--bg)`}
    >
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-(--primary)">
            {title}
          </h2>

          <p className="text-lg text-(--text-secondary) mt-2">
            {subtitle}
          </p>
        </div>

        {/* Content */}
        {children ?? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            <div className="h-56 rounded-xl bg-(--card-bg) border border-(--border-color) flex items-center justify-center">
              Package Card
            </div>

            <div className="h-56 rounded-xl bg-(--card-bg) border border-(--border-color) flex items-center justify-center">
              Package Card
            </div>

            <div className="h-56 rounded-xl bg-(--card-bg) border border-(--border-color) flex items-center justify-center">
              Package Card
            </div>

          </div>
        )}

      </div>
    </section>
  )
}