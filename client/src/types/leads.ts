export type PreferredContact = "call" | "whatsapp" | "email"

export interface CreateLeadPayload {
  name: string
  phone: string
  email?: string
  preferredContact: PreferredContact
  eventType: string
  location: string
  city?: string
  packageName?: string
  packageLabel?: string
  addOns?: string[]
  eventDate: string
  guestCount: number
  budgetMin: number
  budgetMax: number
  notes?: string
}

export interface LeadResponse {
  id?: string
  status?: string
  createdAt?: string
  eventType?: string
  location?: string
  eventDate?: string
  guestCount?: number
  budgetMin?: number
  budgetMax?: number
  notes?: string
}

export interface BookingSelection {
  serviceLabel: string
  packageName?: string
  packageLabel?: string
  packageGuests?: string
  packagePrice?: string
  addOns?: string[]
}
