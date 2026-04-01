import type { SVGProps } from "react"

type IconProps = SVGProps<SVGSVGElement>

function IconBase({
  children,
  viewBox = "0 0 24 24",
  ...props
}: IconProps & { children: React.ReactNode; viewBox?: string }) {
  return (
    <svg
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
      shapeRendering="geometricPrecision"
      style={{ display: "block" }}
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export function BearIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="7.5" cy="7" r="2.5" />
      <circle cx="16.5" cy="7" r="2.5" />
      <path d="M6 11.5c0-3.3 2.7-6 6-6s6 2.7 6 6v2.2c0 3.8-2.8 6.8-6 6.8s-6-3-6-6.8v-2.2z" />
      <path d="M10 14.5c.6-.7 1.3-1 2-1s1.4.3 2 1" />
      <circle cx="10" cy="12.5" r=".6" fill="currentColor" stroke="none" />
      <circle cx="14" cy="12.5" r=".6" fill="currentColor" stroke="none" />
      <path d="M12 11l1.2 1H10.8L12 11z" fill="currentColor" stroke="none" />
    </IconBase>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </IconBase>
  )
}

export function SendIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 20L20 4" />
      <path d="M6.5 4h13.5v13.5" />
      <path d="M4 11.5l7 1.5 1.5 7" />
    </IconBase>
  )
}

export function EditIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20z" />
      <path d="M12.5 7L17 11.5" />
    </IconBase>
  )
}

export function TrashIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 7h14" />
      <path d="M9 7V4.5h6V7" />
      <path d="M7 7l1 12h8l1-12" />
      <path d="M10 10.5v5" />
      <path d="M14 10.5v5" />
    </IconBase>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </IconBase>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </IconBase>
  )
}

export function PanelIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4" y="5" width="16" height="14" rx="2.5" />
      <path d="M9 5v14" />
    </IconBase>
  )
}

export function PinIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9 4.5h6l-1.1 4.2 2.6 2.6v1.2H7.5v-1.2l2.6-2.6L9 4.5z" />
      <path d="M12 12.5v7" />
    </IconBase>
  )
}

export function ArchiveIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4" y="6" width="16" height="12" rx="2.5" />
      <path d="M4.5 9.5h15" />
      <path d="M10 13h4" />
    </IconBase>
  )
}
