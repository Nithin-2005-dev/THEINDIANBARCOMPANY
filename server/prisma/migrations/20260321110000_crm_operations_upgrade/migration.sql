-- Expand enums for operational roles and audit coverage
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SALES';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'OPS';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'FINANCE';

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LEAD_NOTE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LEAD_NOTE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LEAD_NOTE_DELETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LEAD_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LEAD_MANUAL_ACTIVITY';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LEAD_ASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROJECT_ASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROJECT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'USER_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'USER_ROLE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'USER_STATUS_UPDATED';

-- New enums for CRM activity and assignment workflows
CREATE TYPE "LeadActivityType" AS ENUM (
  'STATUS_CHANGED',
  'NOTE_ADDED',
  'NOTE_UPDATED',
  'NOTE_DELETED',
  'PROPOSAL_CREATED',
  'CONTRACT_CREATED',
  'PAYMENT_CREATED',
  'PAYMENT_UPDATED',
  'MANUAL_ACTION',
  'OWNER_ASSIGNED',
  'SUPPORTING_STAFF_ASSIGNED'
);

CREATE TYPE "AssignmentRole" AS ENUM ('PRIMARY', 'SUPPORTING');

-- Lead internal notes
CREATE TABLE "LeadInternalNote" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LeadInternalNote_pkey" PRIMARY KEY ("id")
);

-- Lead activity timeline
CREATE TABLE "LeadActivity" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "type" "LeadActivityType" NOT NULL,
  "actorId" TEXT,
  "description" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- Lead status history
CREATE TABLE "LeadStatusHistory" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "oldStatus" "LeadStatus",
  "newStatus" "LeadStatus" NOT NULL,
  "changedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeadStatusHistory_pkey" PRIMARY KEY ("id")
);

-- Lead staff assignment history
CREATE TABLE "LeadAssignment" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "AssignmentRole" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "assignedById" TEXT,
  "endedById" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "notes" TEXT,

  CONSTRAINT "LeadAssignment_pkey" PRIMARY KEY ("id")
);

-- Project staff assignment history
CREATE TABLE "ProjectAssignment" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "AssignmentRole" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "assignedById" TEXT,
  "endedById" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "notes" TEXT,

  CONSTRAINT "ProjectAssignment_pkey" PRIMARY KEY ("id")
);

-- Performance indexes
CREATE INDEX "Lead_eventDate_idx" ON "Lead"("eventDate");
CREATE INDEX "Lead_location_idx" ON "Lead"("location");
CREATE INDEX "Lead_budgetMin_budgetMax_idx" ON "Lead"("budgetMin", "budgetMax");
CREATE INDEX "Project_progress_idx" ON "Project"("progress");

CREATE INDEX "LeadInternalNote_leadId_createdAt_idx" ON "LeadInternalNote"("leadId", "createdAt");
CREATE INDEX "LeadInternalNote_authorId_idx" ON "LeadInternalNote"("authorId");
CREATE INDEX "LeadInternalNote_deletedAt_idx" ON "LeadInternalNote"("deletedAt");

CREATE INDEX "LeadActivity_leadId_createdAt_idx" ON "LeadActivity"("leadId", "createdAt");
CREATE INDEX "LeadActivity_actorId_idx" ON "LeadActivity"("actorId");
CREATE INDEX "LeadActivity_type_idx" ON "LeadActivity"("type");

CREATE INDEX "LeadStatusHistory_leadId_createdAt_idx" ON "LeadStatusHistory"("leadId", "createdAt");
CREATE INDEX "LeadStatusHistory_changedById_idx" ON "LeadStatusHistory"("changedById");

CREATE INDEX "LeadAssignment_leadId_isActive_idx" ON "LeadAssignment"("leadId", "isActive");
CREATE INDEX "LeadAssignment_userId_isActive_idx" ON "LeadAssignment"("userId", "isActive");
CREATE INDEX "LeadAssignment_role_isActive_idx" ON "LeadAssignment"("role", "isActive");

CREATE INDEX "ProjectAssignment_projectId_isActive_idx" ON "ProjectAssignment"("projectId", "isActive");
CREATE INDEX "ProjectAssignment_userId_isActive_idx" ON "ProjectAssignment"("userId", "isActive");
CREATE INDEX "ProjectAssignment_role_isActive_idx" ON "ProjectAssignment"("role", "isActive");

-- Foreign keys
ALTER TABLE "LeadInternalNote"
  ADD CONSTRAINT "LeadInternalNote_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadInternalNote"
  ADD CONSTRAINT "LeadInternalNote_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LeadActivity"
  ADD CONSTRAINT "LeadActivity_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadActivity"
  ADD CONSTRAINT "LeadActivity_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadStatusHistory"
  ADD CONSTRAINT "LeadStatusHistory_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadStatusHistory"
  ADD CONSTRAINT "LeadStatusHistory_changedById_fkey"
  FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadAssignment"
  ADD CONSTRAINT "LeadAssignment_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadAssignment"
  ADD CONSTRAINT "LeadAssignment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LeadAssignment"
  ADD CONSTRAINT "LeadAssignment_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadAssignment"
  ADD CONSTRAINT "LeadAssignment_endedById_fkey"
  FOREIGN KEY ("endedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectAssignment"
  ADD CONSTRAINT "ProjectAssignment_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectAssignment"
  ADD CONSTRAINT "ProjectAssignment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectAssignment"
  ADD CONSTRAINT "ProjectAssignment_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectAssignment"
  ADD CONSTRAINT "ProjectAssignment_endedById_fkey"
  FOREIGN KEY ("endedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
