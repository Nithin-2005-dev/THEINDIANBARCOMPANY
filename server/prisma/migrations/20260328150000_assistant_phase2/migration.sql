-- AlterTable
ALTER TABLE "AiConversation"
ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "pinnedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AiAssistantEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "messageId" TEXT,
    "role" "Role" NOT NULL,
    "eventType" TEXT NOT NULL,
    "pageKey" TEXT,
    "section" TEXT,
    "intent" TEXT,
    "label" TEXT,
    "contentSnippet" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAssistantEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiConversation_userId_isArchived_isPinned_updatedAt_idx" ON "AiConversation"("userId", "isArchived", "isPinned", "updatedAt");

-- CreateIndex
CREATE INDEX "AiAssistantEvent_userId_createdAt_idx" ON "AiAssistantEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiAssistantEvent_role_eventType_createdAt_idx" ON "AiAssistantEvent"("role", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "AiAssistantEvent_conversationId_createdAt_idx" ON "AiAssistantEvent"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiAssistantEvent" ADD CONSTRAINT "AiAssistantEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAssistantEvent" ADD CONSTRAINT "AiAssistantEvent_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
