-- CreateEnum
CREATE TYPE "OtpChannel" AS ENUM ('PHONE', 'EMAIL');

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "phone" DROP NOT NULL;

-- AlterTable
ALTER TABLE "OtpChallenge"
ADD COLUMN "channel" "OtpChannel" NOT NULL DEFAULT 'PHONE',
ADD COLUMN "email" TEXT,
ADD COLUMN "identifier" TEXT;

-- Backfill
UPDATE "OtpChallenge"
SET "identifier" = "phone"
WHERE "identifier" IS NULL;

-- Finalize
ALTER TABLE "OtpChallenge" ALTER COLUMN "identifier" SET NOT NULL;

-- DropIndex
DROP INDEX IF EXISTS "OtpChallenge_phone_status_createdAt_idx";

-- CreateIndex
CREATE INDEX "OtpChallenge_identifier_status_createdAt_idx"
ON "OtpChallenge"("identifier", "status", "createdAt");
