type BookingAnalyticsEvent =
  | "onBookingStarted"
  | "onBookingSubmitted"
  | "onBookingSuccess"
  | "onBookingError"

type BookingAnalyticsPayload = Record<string, unknown>

declare global {
  interface Window {
    __bookingAnalyticsHook?: (
      event: BookingAnalyticsEvent,
      payload: BookingAnalyticsPayload,
    ) => void
  }
}

export function emitBookingEvent(
  event: BookingAnalyticsEvent,
  payload: BookingAnalyticsPayload,
) {
  if (typeof window === "undefined") return

  window.dispatchEvent(
    new CustomEvent(`booking:${event}`, {
      detail: payload,
    }),
  )

  window.__bookingAnalyticsHook?.(event, payload)
}
