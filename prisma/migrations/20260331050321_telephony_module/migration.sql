-- CreateEnum
CREATE TYPE "CallProvider" AS ENUM ('telnyx', 'twilio');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('queued', 'ringing', 'answered', 'completed', 'failed', 'no_answer', 'busy', 'voicemail', 'cancelled');

-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('outbound');

-- CreateEnum
CREATE TYPE "AmdResult" AS ENUM ('human', 'voicemail', 'unknown', 'not_checked');

-- CreateEnum
CREATE TYPE "VoicemailAction" AS ENUM ('hung_up', 'left_message', 'retry_scheduled');

-- CreateEnum
CREATE TYPE "CallIntentResult" AS ENUM ('interested', 'not_interested', 'callback_requested', 'dnc_requested', 'undetermined');

-- CreateEnum
CREATE TYPE "CallComplianceResult" AS ENUM ('passed', 'blocked');

-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "campaign_id" VARCHAR(255) NOT NULL,
    "lead_id" VARCHAR(255) NOT NULL,
    "provider" "CallProvider" NOT NULL,
    "provider_call_id" VARCHAR(255),
    "from_number" VARCHAR(20) NOT NULL,
    "to_number" VARCHAR(20) NOT NULL,
    "status" "CallStatus" NOT NULL,
    "direction" "CallDirection" NOT NULL DEFAULT 'outbound',
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "duration_seconds" INTEGER,
    "recording_url" VARCHAR(500),
    "recording_duration_seconds" INTEGER,
    "amd_result" "AmdResult" NOT NULL DEFAULT 'not_checked',
    "voicemail_action" "VoicemailAction",
    "disconnect_reason" VARCHAR(255),
    "cost_amount" DECIMAL(10,4),
    "cost_currency" VARCHAR(3) NOT NULL DEFAULT 'SEK',
    "intent_result" "CallIntentResult",
    "sentiment_score" DECIMAL(3,2),
    "transcript_url" VARCHAR(500),
    "compliance_result" "CallComplianceResult" NOT NULL,
    "compliance_block_reason" VARCHAR(100),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Call_org_id_status_idx" ON "Call"("org_id", "status");

-- CreateIndex
CREATE INDEX "Call_org_id_campaign_id_idx" ON "Call"("org_id", "campaign_id");

-- CreateIndex
CREATE INDEX "Call_org_id_lead_id_idx" ON "Call"("org_id", "lead_id");

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
