import type {
  AdminAnalyticsResponse,
  AdminUser,
  Lead,
  Payment,
  Project,
} from "@/types/admin"
import type { PortalInboxConversation } from "@/types/client-portal"

export type StaffTask = {
  id: string
  projectId: string
  title: string
  description?: string | null
  status: "PENDING" | "IN_PROGRESS" | "DONE" | "BLOCKED"
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  dueDate?: string | null
  completedAt?: string | null
  blockedReason?: string | null
  dependencyIds: string[]
  checklist?: Array<{
    id: string
    label: string
    done: boolean
  }> | null
  assignedUserId?: string | null
  assignedVendorId?: string | null
  assignedUser?: AdminUser | null
  assignedVendor?: {
    id: string
    name: string
    serviceType: string
    user?: AdminUser | null
  } | null
  attachments: Array<{
    id: string
    fileKey: string
    fileName: string
    fileUrl: string
    contentType: string
    sizeBytes: number
    createdAt: string
  }>
  comments: Array<{
    id: string
    body: string
    createdAt: string
    author?: AdminUser | null
  }>
  activities: Array<{
    id: string
    type: string
    description: string
    createdAt: string
    actor?: AdminUser | null
  }>
}

export type StaffProjectDocument = {
  id: string
  fileName: string
  fileUrl: string
  category: string
  createdAt: string
  uploadedBy?: AdminUser | null
}

export type StaffProjectUpdate = {
  id: string
  title: string
  body?: string | null
  stage: string
  createdAt: string
  createdBy?: AdminUser | null
}

export type StaffInboxThread = PortalInboxConversation

export type StaffNotification = {
  id: string
  type: string
  title: string
  body: string
  actionUrl?: string | null
  readAt?: string | null
  createdAt: string
}

export type StaffDashboardResponse = {
  profile: {
    id: string
    role: string
  }
  summary: {
    assignedLeads: number
    activeProjects: number
    openTasks: number
    overdueTasks: number
    outstandingPayments: number
  }
  leads: Lead[]
  projects: Project[]
  tasks: StaffTask[]
  payments: Payment[]
  inbox: StaffInboxThread[]
  notifications: StaffNotification[]
}

export type ExtendedAdminAnalyticsResponse = AdminAnalyticsResponse & {
  funnel?: {
    leads: number
    proposalsSent: number
    proposalsAccepted: number
    signedContracts: number
    activeProjects: number
    completedProjects: number
    conversionRate: number
  }
  revenueByPeriod?: Array<{
    period: string
    paid: number
  }>
  overduePayments?: {
    count: number
    amount: number
    items: Payment[]
  }
  sourceTracking?: Array<{
    source: string
    count: number
  }>
  completionMetrics?: {
    completedProjects: number
    totalProjects: number
    completionRate: number
  }
  upcomingWorkload?: {
    next7Days: number
    next30Days: number
    byCity: Array<{
      city: string
      count: number
    }>
  }
  staffPerformance?: Array<{
    id: string
    name?: string | null
    role: string
    activeLeadAssignments: number
    activeProjectAssignments: number
    openTasks: number
    completedTasks: number
  }>
  vendorPerformance?: Array<{
    id: string
    name: string
    serviceType: string
    activeProjects: number
    openTasks: number
    completedTasks: number
  }>
}
