import type { AdminUser } from "@/types/admin"
import type { StaffNotification, StaffTask } from "@/types/staff"

export type VendorDashboardResponse = {
  vendor: {
    id: string
    name: string
    serviceType: string
    phone?: string | null
    email?: string | null
  }
  summary: {
    assignedProjects: number
    openTasks: number
    completedTasks: number
  }
  projects: Array<{
    id: string
    title: string
    eventType: string
    location: string
    eventDate: string
    status: string
    progress: number
    openTasks: number
    paymentSummary: {
      paid: number
      outstanding: number
    }
  }>
  notifications: StaffNotification[]
}

export type VendorProjectResponse = {
  project: {
    id: string
    status: string
    progress: number
    summary?: string | null
  }
  event: {
    leadId: string
    title: string
    eventType: string
    location: string
    city?: string | null
    eventDate: string
    notes?: string | null
  }
  opsContact?: AdminUser | null
  tasks: StaffTask[]
  updates: Array<{
    id: string
    title: string
    body?: string | null
    stage: string
    createdAt: string
    createdBy?: AdminUser | null
  }>
  documents: Array<{
    id: string
    fileName: string
    fileUrl: string
    category: string
    createdAt: string
    uploadedBy?: AdminUser | null
  }>
  payments: Array<{
    id: string
    type: string
    status: string
    amount: number
    currency: string
    dueDate?: string | null
    paidAt?: string | null
  }>
}
