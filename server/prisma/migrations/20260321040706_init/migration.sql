-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CLIENT', 'VENDOR');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'NEGOTIATING', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'SENT', 'SIGNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'PREPARATION', 'EXECUTION', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('ADVANCE', 'MID', 'FINAL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('OTP_SENT', 'OTP_VERIFIED', 'OTP_FAILED', 'LOGIN', 'REFRESH_TOKEN_ISSUED', 'REFRESH_TOKEN_REVOKED', 'LOGOUT', 'SESSION_REVOKED', 'SUSPICIOUS_ACTIVITY_DETECTED', 'LEAD_CREATED', 'LEAD_UPDATED', 'PROPOSAL_CREATED', 'PROPOSAL_DECIDED', 'CONTRACT_SIGNED', 'PAYMENT_ORDER_CREATED', 'PAYMENT_CAPTURED', 'PAYMENT_WEBHOOK_PROCESSED', 'VENDOR_ASSIGNED', 'FILE_UPLOADED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED', 'SUSPICIOUS');

-- CreateEnum
CREATE TYPE "OtpChallengeStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'EXPIRED', 'LOCKED', 'CONSUMED');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CLIENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "city" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "guestCount" INTEGER,
    "budgetMin" INTEGER,
    "budgetMax" INTEGER,
    "notes" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "clientId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "scope" TEXT NOT NULL,
    "deliverables" TEXT NOT NULL,
    "timeline" TEXT NOT NULL,
    "notes" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "signedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "pricingInfo" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectVendor" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectVendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "PaymentType" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "gateway" TEXT NOT NULL DEFAULT 'RAZORPAY',
    "gatewayOrderId" TEXT,
    "transactionId" TEXT,
    "gatewaySignature" TEXT,
    "gatewayMetadata" JSONB,
    "webhookEventId" TEXT,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractDocumentVersion" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "userId" TEXT,
    "ipAddress" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "deviceFingerprint" TEXT,
    "userAgent" TEXT,
    "initialIpAddress" TEXT,
    "lastIpAddress" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "suspiciousActivityAt" TIMESTAMP(3),
    "suspiciousReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "phone" TEXT NOT NULL,
    "otpCodeHash" TEXT NOT NULL,
    "status" "OtpChallengeStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "cooldownUntil" TIMESTAMP(3),
    "requestIpAddress" TEXT,
    "verifyIpAddress" TEXT,
    "abuseDetectedAt" TIMESTAMP(3),
    "abuseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
    "responseCode" INTEGER,
    "responseBody" JSONB,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE INDEX "Lead_clientId_idx" ON "Lead"("clientId");

-- CreateIndex
CREATE INDEX "Lead_deletedAt_idx" ON "Lead"("deletedAt");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Proposal_deletedAt_idx" ON "Proposal"("deletedAt");

-- CreateIndex
CREATE INDEX "Proposal_leadId_idx" ON "Proposal"("leadId");

-- CreateIndex
CREATE INDEX "Proposal_status_idx" ON "Proposal"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_proposalId_key" ON "Contract"("proposalId");

-- CreateIndex
CREATE INDEX "Contract_deletedAt_idx" ON "Contract"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Project_contractId_key" ON "Project"("contractId");

-- CreateIndex
CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");

-- CreateIndex
CREATE INDEX "Project_deletedAt_idx" ON "Project"("deletedAt");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Vendor_deletedAt_idx" ON "Vendor"("deletedAt");

-- CreateIndex
CREATE INDEX "Vendor_serviceType_idx" ON "Vendor"("serviceType");

-- CreateIndex
CREATE INDEX "ProjectVendor_vendorId_idx" ON "ProjectVendor"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectVendor_projectId_vendorId_key" ON "ProjectVendor"("projectId", "vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_webhookEventId_key" ON "Payment"("webhookEventId");

-- CreateIndex
CREATE INDEX "Payment_deletedAt_idx" ON "Payment"("deletedAt");

-- CreateIndex
CREATE INDEX "Payment_projectId_idx" ON "Payment"("projectId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "ContractDocumentVersion_contractId_idx" ON "ContractDocumentVersion"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractDocumentVersion_contractId_version_key" ON "ContractDocumentVersion"("contractId", "version");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON "Session"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_status_idx" ON "Session"("userId", "status");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "OtpChallenge_phone_status_createdAt_idx" ON "OtpChallenge"("phone", "status", "createdAt");

-- CreateIndex
CREATE INDEX "OtpChallenge_expiresAt_idx" ON "OtpChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "IdempotencyKey_userId_scope_idx" ON "IdempotencyKey"("userId", "scope");

-- CreateIndex
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_key_scope_key" ON "IdempotencyKey"("key", "scope");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectVendor" ADD CONSTRAINT "ProjectVendor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectVendor" ADD CONSTRAINT "ProjectVendor_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractDocumentVersion" ADD CONSTRAINT "ContractDocumentVersion_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtpChallenge" ADD CONSTRAINT "OtpChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
