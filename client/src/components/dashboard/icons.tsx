import type { SVGProps } from "react"

type IconProps = SVGProps<SVGSVGElement>

function DashboardIcon({
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

export function HomeIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M9 20v-6h6v6" />
    </DashboardIcon>
  )
}

export function BookingsIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M7.5 3.5v3" />
      <path d="M16.5 3.5v3" />
      <path d="M3.5 9.5h17" />
      <path d="M8 13h3" />
      <path d="M13 13h3" />
      <path d="M8 16h3" />
    </DashboardIcon>
  )
}

export function PaymentsIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <path d="M12 3.5v17" />
      <path d="M16.5 7.5c0-1.9-1.9-3.5-4.5-3.5S7.5 5.6 7.5 7.5 9.4 11 12 11s4.5 1.6 4.5 3.5S14.6 18 12 18s-4.5-1.6-4.5-3.5" />
    </DashboardIcon>
  )
}

export function MessagesIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <path d="M5 6.5h14a2.5 2.5 0 012.5 2.5v6A2.5 2.5 0 0119 17.5H11l-4.5 3v-3H5A2.5 2.5 0 012.5 15V9A2.5 2.5 0 015 6.5z" />
      <path d="M7 10.5h10" />
      <path d="M7 13.5h6" />
    </DashboardIcon>
  )
}

export function NotificationsIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <path d="M8.5 18.5h7" />
      <path d="M6 16.5V11a6 6 0 1112 0v5.5l1.5 1.5H4.5L6 16.5z" />
      <path d="M10 20a2 2 0 004 0" />
    </DashboardIcon>
  )
}

export function EmailIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="M4.5 7l7.5 6 7.5-6" />
      <path d="M8 11.5l-3.5 3" />
      <path d="M16 11.5l3.5 3" />
    </DashboardIcon>
  )
}

export function AnalyticsIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <path d="M4 19.5h16" />
      <path d="M7 16V10" />
      <path d="M12 16V6" />
      <path d="M17 16v-4" />
    </DashboardIcon>
  )
}

export function PipelineIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <rect x="3.5" y="5" width="5" height="14" rx="2" />
      <rect x="9.5" y="8" width="5" height="11" rx="2" />
      <rect x="15.5" y="11" width="5" height="8" rx="2" />
    </DashboardIcon>
  )
}

export function ProjectsIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <path d="M4 8.5h16" />
      <path d="M9 4.5h6l1 4H8l1-4z" />
      <rect x="3.5" y="8.5" width="17" height="11" rx="2.5" />
      <path d="M9 13h6" />
    </DashboardIcon>
  )
}

export function TasksIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <path d="M9 7.5h10" />
      <path d="M9 12h10" />
      <path d="M9 16.5h10" />
      <path d="M4 7.5l1.5 1.5L8 6.5" />
      <path d="M4 12l1.5 1.5L8 11" />
      <path d="M4 16.5l1.5 1.5L8 15.5" />
    </DashboardIcon>
  )
}

export function TeamIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <path d="M8 11a3 3 0 100-6 3 3 0 000 6z" />
      <path d="M16.5 10a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
      <path d="M4 19a4 4 0 018 0" />
      <path d="M13 19a3.5 3.5 0 017 0" />
    </DashboardIcon>
  )
}

export function ProfilesIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <rect x="4" y="5" width="16" height="14" rx="2.5" />
      <path d="M9 10a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
      <path d="M6.5 16a3 3 0 015 0" />
      <path d="M13.5 9h4" />
      <path d="M13.5 12h4" />
      <path d="M13.5 15h3" />
    </DashboardIcon>
  )
}

export function VendorsIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <path d="M4 7.5L12 4l8 3.5-8 3.5L4 7.5z" />
      <path d="M4 12l8 3.5 8-3.5" />
      <path d="M4 16.5L12 20l8-3.5" />
    </DashboardIcon>
  )
}

export function SettingsIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <path d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z" />
      <path d="M19 12a7.02 7.02 0 00-.1-1.1l2-1.5-2-3.4-2.3.8a7.3 7.3 0 00-1.9-1.1L14.3 3h-4.6l-.4 2.7a7.3 7.3 0 00-1.9 1.1l-2.3-.8-2 3.4 2 1.5A7.02 7.02 0 005 12c0 .37.03.74.1 1.1l-2 1.5 2 3.4 2.3-.8c.58.46 1.22.83 1.9 1.1l.4 2.7h4.6l.4-2.7c.68-.27 1.32-.64 1.9-1.1l2.3.8 2-3.4-2-1.5c.07-.36.1-.73.1-1.1z" />
    </DashboardIcon>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </DashboardIcon>
  )
}

export function ThemeIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <path d="M12 3.5v2.5" />
      <path d="M12 18v2.5" />
      <path d="M4.9 4.9l1.8 1.8" />
      <path d="M17.3 17.3l1.8 1.8" />
      <path d="M3.5 12H6" />
      <path d="M18 12h2.5" />
      <path d="M4.9 19.1l1.8-1.8" />
      <path d="M17.3 6.7l1.8-1.8" />
      <circle cx="12" cy="12" r="3.5" />
    </DashboardIcon>
  )
}

export function MenuIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <path d="M4 7.5h16" />
      <path d="M4 12h16" />
      <path d="M4 16.5h16" />
    </DashboardIcon>
  )
}

export function LogoutIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <path d="M9 20H6.5A2.5 2.5 0 014 17.5v-11A2.5 2.5 0 016.5 4H9" />
      <path d="M14 16l4-4-4-4" />
      <path d="M18 12H9" />
    </DashboardIcon>
  )
}

export function HealthIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <path d="M4 12h3l2-4 3 8 2-4h6" />
    </DashboardIcon>
  )
}

export function DocumentsIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <path d="M8 3.5h6l4 4V20a1.5 1.5 0 01-1.5 1.5h-8A1.5 1.5 0 017 20V5a1.5 1.5 0 011.5-1.5z" />
      <path d="M14 3.5V8h4" />
      <path d="M9.5 12h5" />
      <path d="M9.5 15.5h5" />
    </DashboardIcon>
  )
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <path d="M6 9l6 6 6-6" />
    </DashboardIcon>
  )
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <path d="M9 6l6 6-6 6" />
    </DashboardIcon>
  )
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <path d="M15 6l-6 6 6 6" />
    </DashboardIcon>
  )
}

export function SidebarCollapseIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M8.5 4.5v15" />
      <path d="M14 12h4" />
      <path d="M16 10l2 2-2 2" />
    </DashboardIcon>
  )
}

export function CommandIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <path d="M8 8h0a3 3 0 110-6 3 3 0 013 3v14a3 3 0 11-3-3h8a3 3 0 100-6H8a3 3 0 100 6h8a3 3 0 110 6 3 3 0 01-3-3V5a3 3 0 013-3 3 3 0 110 6" />
    </DashboardIcon>
  )
}

export function SparklesIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <path d="M12 3.5l1.6 4.4 4.4 1.6-4.4 1.6-1.6 4.4-1.6-4.4-4.4-1.6 4.4-1.6L12 3.5z" />
      <path d="M18 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z" />
      <path d="M6 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z" />
    </DashboardIcon>
  )
}

export function ArrowUpRightIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <path d="M8 16L16 8" />
      <path d="M10 8h6v6" />
    </DashboardIcon>
  )
}

export function AttachmentIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <path d="M9.5 13.5l5-5a3 3 0 114.2 4.2l-7.3 7.3a5 5 0 11-7.1-7.1l7.1-7.1a3.5 3.5 0 114.9 4.9L9 17a2 2 0 01-2.8-2.8l5.6-5.6" />
    </DashboardIcon>
  )
}

export function OverviewIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <rect x="4" y="4" width="7" height="7" rx="2" />
      <rect x="13" y="4" width="7" height="4.5" rx="2" />
      <rect x="13" y="10.5" width="7" height="9.5" rx="2" />
      <rect x="4" y="13" width="7" height="7" rx="2" />
    </DashboardIcon>
  )
}

export function TimelineIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <path d="M7 6.5h10" />
      <path d="M7 12h10" />
      <path d="M7 17.5h10" />
      <circle cx="5" cy="6.5" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="17.5" r="1" />
    </DashboardIcon>
  )
}

export function ContractIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <path d="M8 3.5h8A2.5 2.5 0 0118.5 6v13A1.5 1.5 0 0117 20.5h-10A1.5 1.5 0 015.5 19V6A2.5 2.5 0 018 3.5z" />
      <path d="M8 8.5h8" />
      <path d="M8 12h5" />
      <path d="M8 15.5h4" />
      <path d="M14.5 18l1.5-1.5 1.5 1.5" />
    </DashboardIcon>
  )
}

export function FolderIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <path d="M3.5 7A2.5 2.5 0 016 4.5h3l2 2H18A2.5 2.5 0 0120.5 9v7A2.5 2.5 0 0118 18.5H6A2.5 2.5 0 013.5 16V7z" />
    </DashboardIcon>
  )
}

export function UpdatesIcon(props: IconProps) {
  return (
    <DashboardIcon {...props}>
      <path d="M18 8a6.5 6.5 0 10.5 5" />
      <path d="M18 4.5V8h-3.5" />
      <path d="M12 8.5V12l2.5 1.5" />
    </DashboardIcon>
  )
}
