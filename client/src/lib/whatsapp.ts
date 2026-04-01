import type { CreateLeadPayload } from "@/types/leads"

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER

export function buildWhatsAppMessage(payload: Partial<CreateLeadPayload>) {
  return [
    "Hello The Indian Bar Company, I'd like a faster response for my booking request.",
    payload.name ? `Name: ${payload.name}` : "",
    payload.phone ? `Phone: ${payload.phone}` : "",
    payload.preferredContact ? `Preferred contact: ${payload.preferredContact}` : "",
    payload.eventType ? `Event: ${payload.eventType}` : "",
    payload.location ? `Location: ${payload.location}` : "",
    payload.eventDate ? `Event date: ${payload.eventDate}` : "",
    payload.guestCount ? `Guests: ${payload.guestCount}` : "",
    payload.budgetMin && payload.budgetMax
      ? `Budget: INR ${payload.budgetMin} - INR ${payload.budgetMax}`
      : "",
    payload.notes ? `Notes: ${payload.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

export function buildWhatsAppUrl(payload: Partial<CreateLeadPayload>) {
  if (!WHATSAPP_NUMBER) return null

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    buildWhatsAppMessage(payload),
  )}`
}
