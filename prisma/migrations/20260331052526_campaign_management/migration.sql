-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'active', 'paused', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "CampaignAmdAction" AS ENUM ('hang_up', 'leave_message', 'retry_later');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('pending', 'in_progress', 'contacted', 'converted', 'dnc', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('processing', 'completed', 'failed');

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "script" TEXT NOT NULL,
    "voice_id" VARCHAR(100) NOT NULL,
    "language" VARCHAR(10) NOT NULL DEFAULT 'sv',
    "caller_id" VARCHAR(20) NOT NULL,
    "disclosure_id" TEXT NOT NULL,
    "schedule_timezone" VARCHAR(50) NOT NULL DEFAULT 'Europe/Stockholm',
    "schedule_start_time" VARCHAR(5) NOT NULL,
    "schedule_end_time" VARCHAR(5) NOT NULL,
    "schedule_days" JSONB NOT NULL,
    "max_concurrent_calls" INTEGER NOT NULL DEFAULT 10,
    "max_attempts_per_lead" INTEGER NOT NULL DEFAULT 3,
    "retry_interval_minutes" INTEGER NOT NULL DEFAULT 60,
    "amd_action" "CampaignAmdAction" NOT NULL DEFAULT 'hang_up',
    "voicemail_script" TEXT,
    "created_by" TEXT NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255),
    "status" "LeadStatus" NOT NULL DEFAULT 'pending',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_attempted_at" TIMESTAMP(3),
    "custom_fields" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadUpload" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'processing',
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "valid_rows" INTEGER NOT NULL DEFAULT 0,
    "invalid_rows" INTEGER NOT NULL DEFAULT 0,
    "duplicate_rows" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Campaign_org_id_status_idx" ON "Campaign"("org_id", "status");

-- CreateIndex
CREATE INDEX "Lead_campaign_id_status_idx" ON "Lead"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "Lead_campaign_id_phone_idx" ON "Lead"("campaign_id", "phone");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_disclosure_id_fkey" FOREIGN KEY ("disclosure_id") REFERENCES "RecordingDisclosure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadUpload" ADD CONSTRAINT "LeadUpload_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
