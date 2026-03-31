-- Lead Management: expand LeadStatus enum and update Lead table schema
-- Applied via `prisma db push` due to non-interactive shell environment

-- Add new enum values to LeadStatus
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'new';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'queued';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'calling';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'interested';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'not_interested';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'callback_scheduled';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'max_attempts_reached';

-- Rename columns
ALTER TABLE "Lead" RENAME COLUMN "phone" TO "phone_number";
ALTER TABLE "Lead" RENAME COLUMN "attempt_count" TO "call_attempts";
ALTER TABLE "Lead" RENAME COLUMN "last_attempted_at" TO "last_called_at";

-- Add new columns
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "next_call_at" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "callback_requested_at" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "callback_notes" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "upload_id" VARCHAR(255);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "timezone" VARCHAR(50);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- Update indexes
DROP INDEX IF EXISTS "Lead_campaign_id_phone_idx";
CREATE INDEX IF NOT EXISTS "Lead_org_id_campaign_id_status_idx" ON "Lead"("org_id", "campaign_id", "status");
CREATE INDEX IF NOT EXISTS "Lead_org_id_phone_number_idx" ON "Lead"("org_id", "phone_number");
CREATE INDEX IF NOT EXISTS "Lead_campaign_id_next_call_at_idx" ON "Lead"("campaign_id", "next_call_at");
