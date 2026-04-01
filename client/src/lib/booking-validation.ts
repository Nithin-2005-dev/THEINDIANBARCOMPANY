import type { PreferredContact } from "@/types/leads"

export type BookingFormValues = {
  name: string
  phone: string
  email: string
  preferredContact: PreferredContact
  eventType: string
  location: string
  eventDate: string
  guestCount: string
  budgetMin: string
  budgetMax: string
  notes: string
  website: string
}

export type BookingFormErrors = Partial<Record<keyof BookingFormValues, string>>

export const MIN_BOOKING_FILL_MS = 4000

export function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, "")
}

function isPastDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) || date.getTime() < Date.now()
}

export function validateBookingField(
  key: keyof BookingFormValues,
  value: string,
  values: BookingFormValues,
) {
  switch (key) {
    case "name":
      return value.trim().length >= 2 ? undefined : "Please enter your full name."
    case "phone": {
      const normalized = normalizePhone(value)
      return /^\+?\d{10,15}$/.test(normalized)
        ? undefined
        : "Enter a valid phone number so we can reach you."
    }
    case "email":
      if (!value.trim()) {
        return values.preferredContact === "email"
          ? "Email is required when email is your preferred contact method."
          : undefined
      }
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
        ? undefined
        : "Enter a valid email address."
    case "eventType":
      return value.trim() ? undefined : "Tell us what kind of event you are hosting."
    case "location":
      return value.trim() ? undefined : "Please add the event location."
    case "eventDate":
      if (!value) return "Select the event date and time."
      return isPastDate(value) ? "Choose a future event date and time." : undefined
    case "guestCount": {
      const guestCount = Number(value)
      if (!value) return "Guest count helps us size the experience correctly."
      return Number.isInteger(guestCount) && guestCount > 0
        ? undefined
        : "Guest count must be at least 1."
    }
    case "budgetMin": {
      const budgetMin = Number(value)
      if (!value) return "Please share your starting budget."
      return budgetMin >= 0 ? undefined : "Minimum budget cannot be negative."
    }
    case "budgetMax": {
      const budgetMax = Number(value)
      const budgetMin = Number(values.budgetMin)
      if (!value) return "Please share your maximum budget."
      if (budgetMax < 0) return "Maximum budget cannot be negative."
      if (values.budgetMin && budgetMax < budgetMin) {
        return "Maximum budget should be greater than minimum budget."
      }
      return undefined
    }
    case "preferredContact":
      return value ? undefined : "Select how you would like us to contact you."
    default:
      return undefined
  }
}

export function validateBookingForm(values: BookingFormValues) {
  const errors: BookingFormErrors = {}

  const fields: Array<keyof BookingFormValues> = [
    "name",
    "phone",
    "email",
    "preferredContact",
    "eventType",
    "location",
    "eventDate",
    "guestCount",
    "budgetMin",
    "budgetMax",
  ]

  for (const field of fields) {
    const error = validateBookingField(field, values[field], values)
    if (error) {
      errors[field] = error
    }
  }

  return errors
}
