import Card from "@/components/ui/Card/Card"

type PanelProps = {
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
}

export default function Panel({ title, description, children, className }: PanelProps) {
  return (
    <Card
      as="section"
      title={title}
      description={description}
      className={className}
    >
      {children}
    </Card>
  )
}
