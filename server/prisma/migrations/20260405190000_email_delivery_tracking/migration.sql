-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('QUEUED', 'PROCESSING', 'RETRYING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailDeliveryLogEvent" AS ENUM ('QUEUED', 'PROCESSING', 'RETRY_SCHEDULED', 'SENT', 'FAILED', 'RESEND_REQUESTED', 'FORCE_SEND_REQUESTED', 'QUEUEING_FAILED');

-- CreateTable
CREATE TABLE "EmailDelivery" (
    "id" TEXT NOT NULL,
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "emailType" TEXT NOT NULL DEFAULT 'GENERAL',
    "template" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "provider" TEXT,
    "providerMessageId" TEXT,
    "providerAcknowledgedAt" TIMESTAMP(3),
    "providerResponse" JSONB,
    "variables" JSONB,
    "metadata" JSONB,
    "recipientUserId" TEXT,
    "requestedById" TEXT,
    "leadId" TEXT,
    "projectId" TEXT,
    "paymentId" TEXT,
    "proposalId" TEXT,
    "contractId" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 4,
    "lastRetryAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "processingStartedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "allowManualResend" BOOLEAN NOT NULL DEFAULT true,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailDeliveryLog" (
    "id" TEXT NOT NULL,
    "emailDeliveryId" TEXT NOT NULL,
    "event" "EmailDeliveryLogEvent" NOT NULL,
    "attemptNumber" INTEGER,
    "jobId" TEXT,
    "message" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailDeliveryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailDelivery_status_createdAt_idx" ON "EmailDelivery"("status", "createdAt");

-- CreateIndex
CREATE INDEX "EmailDelivery_status_nextRetryAt_idx" ON "EmailDelivery"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "EmailDelivery_emailType_status_idx" ON "EmailDelivery"("emailType", "status");

-- CreateIndex
CREATE INDEX "EmailDelivery_toEmail_idx" ON "EmailDelivery"("toEmail");

-- CreateIndex
CREATE INDEX "EmailDelivery_recipientUserId_createdAt_idx" ON "EmailDelivery"("recipientUserId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailDelivery_leadId_createdAt_idx" ON "EmailDelivery"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailDelivery_projectId_createdAt_idx" ON "EmailDelivery"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailDelivery_paymentId_createdAt_idx" ON "EmailDelivery"("paymentId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailDelivery_proposalId_createdAt_idx" ON "EmailDelivery"("proposalId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailDelivery_contractId_createdAt_idx" ON "EmailDelivery"("contractId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailDeliveryLog_emailDeliveryId_createdAt_idx" ON "EmailDeliveryLog"("emailDeliveryId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailDeliveryLog_event_createdAt_idx" ON "EmailDeliveryLog"("event", "createdAt");

-- AddForeignKey
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDeliveryLog" ADD CONSTRAINT "EmailDeliveryLog_emailDeliveryId_fkey" FOREIGN KEY ("emailDeliveryId") REFERENCES "EmailDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
