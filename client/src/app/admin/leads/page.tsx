import { redirect } from "next/navigation"

export default function AdminLeadsRedirectPage() {
  redirect("/admin/bookings")
}
