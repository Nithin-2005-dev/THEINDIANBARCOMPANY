CREATE TYPE "ProjectStage" AS ENUM ('PLANNING', 'PREPARATION', 'READY', 'EVENT_DAY', 'COMPLETED');
CREATE TYPE "MessageType" AS ENUM ('USER', 'SYSTEM');
CREATE TYPE "NotificationType" AS ENUM (
  'PROPOSAL',
  'PAYMENT',
  'STATUS',
  'MESSAGE',
  'EVENT',
  'CONTRACT',
  'GENERAL'
);

ALTER TABLE "Lead"
  ADD COLUMN "packageName" TEXT,
  ADD COLUMN "packageLabel" TEXT,
  ADD COLUMN "addOns" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Proposal"
  ADD COLUMN "documentUrl" TEXT,
  ADD COLUMN "clientComment" TEXT,
  ADD COLUMN "decidedAt" TIMESTAMP(3);

ALTER TABLE "Contract"
  ADD COLUMN "signedByName" TEXT,
  ADD COLUMN "acceptedTermsAt" TIMESTAMP(3);

ALTER TABLE "Payment"
  ADD COLUMN "receiptUrl" TEXT;

CREATE TABLE "ConversationThread" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ConversationThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Message" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "senderId" TEXT,
  "type" "MessageType" NOT NULL DEFAULT 'USER',
  "body" TEXT NOT NULL,
  "attachmentName" TEXT,
  "attachmentUrl" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectUpdate" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "stage" "ProjectStage" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "createdById" TEXT,
  "isInternal" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProjectUpdate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "actionUrl" TEXT,
  "metadata" JSONB,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventFeedback" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "testimonial" TEXT,
  "comments" TEXT,
  "allowMediaUsage" BOOLEAN NOT NULL DEFAULT false,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EventFeedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConversationThread_leadId_key" ON "ConversationThread"("leadId");
CREATE UNIQUE INDEX "EventFeedback_projectId_key" ON "EventFeedback"("projectId");

CREATE INDEX "Message_threadId_createdAt_idx" ON "Message"("threadId", "createdAt");
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");
CREATE INDEX "Message_readAt_idx" ON "Message"("readAt");
CREATE INDEX "ProjectUpdate_projectId_createdAt_idx" ON "ProjectUpdate"("projectId", "createdAt");
CREATE INDEX "ProjectUpdate_stage_idx" ON "ProjectUpdate"("stage");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

ALTER TABLE "ConversationThread"
  ADD CONSTRAINT "ConversationThread_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message"
  ADD CONSTRAINT "Message_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "ConversationThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message"
  ADD CONSTRAINT "Message_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectUpdate"
  ADD CONSTRAINT "ProjectUpdate_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectUpdate"
  ADD CONSTRAINT "ProjectUpdate_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventFeedback"
  ADD CONSTRAINT "EventFeedback_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
