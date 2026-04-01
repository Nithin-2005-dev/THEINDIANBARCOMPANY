-- CreateEnum
CREATE TYPE "TeamCategory" AS ENUM ('CORE', 'TRUSTEE', 'INFLUENCERS');

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "category" "TeamCategory" NOT NULL,
    "bio" TEXT,
    "photoUrl" TEXT,
    "photoPublicId" TEXT,
    "instagramUrl" TEXT,
    "linkedInUrl" TEXT,
    "websiteUrl" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamMember_deletedAt_idx" ON "TeamMember"("deletedAt");

-- CreateIndex
CREATE INDEX "TeamMember_category_sortOrder_idx" ON "TeamMember"("category", "sortOrder");

-- CreateIndex
CREATE INDEX "TeamMember_isActive_isVisible_idx" ON "TeamMember"("isActive", "isVisible");
