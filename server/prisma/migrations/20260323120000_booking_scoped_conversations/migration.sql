DO $$
BEGIN
  CREATE TYPE "ConversationThreadType" AS ENUM (
    'GROUP',
    'DIRECT_ADMIN',
    'DIRECT_STAFF',
    'DIRECT_VENDOR'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "ConversationThread"
  ADD COLUMN IF NOT EXISTS "type" "ConversationThreadType" NOT NULL DEFAULT 'GROUP';

DROP INDEX IF EXISTS "ConversationThread_leadId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "ConversationThread_leadId_type_key"
  ON "ConversationThread"("leadId", "type");

CREATE INDEX IF NOT EXISTS "ConversationThread_leadId_type_idx"
  ON "ConversationThread"("leadId", "type");
