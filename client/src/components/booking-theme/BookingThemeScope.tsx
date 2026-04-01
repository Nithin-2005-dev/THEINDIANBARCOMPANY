import { createElement } from "react"
import type { CSSProperties, ElementType, ReactNode } from "react"
import { getBookingThemeStyle } from "@/components/booking-theme/booking-theme"

type BookingThemeScopeProps = {
  as?: ElementType
  category?: string | null
  children: ReactNode
  className?: string
  eventType?: string | null
  packageLabel?: string | null
  packageName?: string | null
  service?: string | null
  serviceType?: string | null
  serviceId?: string | null
  style?: CSSProperties
}

export default function BookingThemeScope({
  as: Component = "div",
  category,
  children,
  className,
  eventType,
  packageLabel,
  packageName,
  service,
  serviceId,
  serviceType,
  style,
}: BookingThemeScopeProps) {
  return createElement(
    Component,
    {
      className,
      style: {
        ...getBookingThemeStyle({
          category,
          eventType,
          packageLabel,
          packageName,
          service,
          serviceId,
          serviceType,
        }),
        ...style,
      },
    },
    children,
  )
}
