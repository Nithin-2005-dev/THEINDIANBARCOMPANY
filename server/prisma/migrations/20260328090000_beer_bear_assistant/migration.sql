-- CreateEnum
CREATE TYPE "AiMessageActor" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateTable
CREATE TABLE "AiConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Concierge Thread',
    "lastMessageAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "actor" "AiMessageActor" NOT NULL,
    "role" "Role",
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiConversationContext" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userRole" "Role" NOT NULL,
    "pagePath" TEXT,
    "pageTitle" TEXT,
    "bookingId" TEXT,
    "leadId" TEXT,
    "projectId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiConversationContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiPromptSuggestion" (
    "id" TEXT NOT NULL,
    "role" "Role",
    "pageKey" TEXT,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "description" TEXT,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiPromptSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiConversation_userId_deletedAt_updatedAt_idx" ON "AiConversation"("userId", "deletedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "AiConversation_userId_lastMessageAt_idx" ON "AiConversation"("userId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "AiMessage_conversationId_createdAt_idx" ON "AiMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AiMessage_actor_createdAt_idx" ON "AiMessage"("actor", "createdAt");

-- CreateIndex
CREATE INDEX "AiConversationContext_conversationId_createdAt_idx" ON "AiConversationContext"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AiConversationContext_bookingId_createdAt_idx" ON "AiConversationContext"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "AiConversationContext_leadId_createdAt_idx" ON "AiConversationContext"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "AiConversationContext_projectId_createdAt_idx" ON "AiConversationContext"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AiPromptSuggestion_role_pageKey_isActive_rank_idx" ON "AiPromptSuggestion"("role", "pageKey", "isActive", "rank");

-- AddForeignKey
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiConversationContext" ADD CONSTRAINT "AiConversationContext_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
