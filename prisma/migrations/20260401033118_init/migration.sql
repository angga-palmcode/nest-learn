-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'manager', 'agent');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('prior_express', 'prior_express_written', 'implied');

-- CreateEnum
CREATE TYPE "DncSource" AS ENUM ('national_registry', 'internal_optout', 'manual');

-- CreateEnum
CREATE TYPE "ComplianceCheckType" AS ENUM ('consent', 'dnc', 'calling_window', 'recording_disclosure', 'optout_detection');

-- CreateEnum
CREATE TYPE "ComplianceCheckStatus" AS ENUM ('passed', 'failed', 'skipped');

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

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'active', 'paused', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "CampaignAmdAction" AS ENUM ('hang_up', 'leave_message', 'retry_later');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('new', 'queued', 'calling', 'contacted', 'interested', 'not_interested', 'converted', 'callback_scheduled', 'dnc', 'failed', 'max_attempts_reached');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('processing', 'completed', 'failed');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "industry" VARCHAR(100),
    "mfa_enforced" BOOLEAN NOT NULL DEFAULT false,
    "max_concurrent_calls" INTEGER NOT NULL DEFAULT 100,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Europe/Stockholm',
    "locale" VARCHAR(10) NOT NULL DEFAULT 'sv',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "email_verified_at" TIMESTAMP(3),
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secret" VARCHAR(255),
    "mfa_recovery_codes" JSONB,
    "last_login_at" TIMESTAMP(3),
    "last_login_ip" VARCHAR(45),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "invited_by" TEXT,
    "invited_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "ip_address" VARCHAR(45) NOT NULL,
    "user_agent" TEXT NOT NULL,
    "device_name" VARCHAR(255),
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInvitation" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "invited_by" TEXT NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfaEmailToken" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MfaEmailToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" VARCHAR(100) NOT NULL,
    "resource_type" VARCHAR(100),
    "resource_id" TEXT,
    "metadata" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "lead_id" VARCHAR(255) NOT NULL,
    "consent_type" "ConsentType" NOT NULL,
    "consent_source" VARCHAR(255) NOT NULL,
    "consent_text" TEXT,
    "consented_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" VARCHAR(255),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DncRegistry" (
    "id" TEXT NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "source" "DncSource" NOT NULL,
    "reason" VARCHAR(255),
    "added_at" TIMESTAMP(3) NOT NULL,
    "lead_id" VARCHAR(255),
    "org_id" TEXT,
    "call_id" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DncRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceCheck" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "call_id" VARCHAR(255),
    "lead_id" VARCHAR(255) NOT NULL,
    "check_type" "ComplianceCheckType" NOT NULL,
    "status" "ComplianceCheckStatus" NOT NULL,
    "details" JSONB NOT NULL,
    "checked_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordingDisclosure" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "text" TEXT NOT NULL,
    "audio_url" VARCHAR(500) NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "jurisdiction" VARCHAR(50) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecordingDisclosure_pkey" PRIMARY KEY ("id")
);

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
    "phone_number" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255),
    "status" "LeadStatus" NOT NULL DEFAULT 'new',
    "call_attempts" INTEGER NOT NULL DEFAULT 0,
    "last_called_at" TIMESTAMP(3),
    "next_call_at" TIMESTAMP(3),
    "callback_requested_at" TIMESTAMP(3),
    "callback_notes" TEXT,
    "custom_fields" JSONB,
    "upload_id" VARCHAR(255),
    "timezone" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

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

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "secret" VARCHAR(255) NOT NULL,
    "events" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoRequest" (
    "id" TEXT NOT NULL,
    "company_name" VARCHAR(255) NOT NULL,
    "contact_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(30),
    "industry" VARCHAR(100),
    "message" TEXT,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'sv',
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "UserInvitation_token_key" ON "UserInvitation"("token");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "DncRegistry_phone_number_org_id_idx" ON "DncRegistry"("phone_number", "org_id");

-- CreateIndex
CREATE INDEX "Call_org_id_status_idx" ON "Call"("org_id", "status");

-- CreateIndex
CREATE INDEX "Call_org_id_campaign_id_idx" ON "Call"("org_id", "campaign_id");

-- CreateIndex
CREATE INDEX "Call_org_id_lead_id_idx" ON "Call"("org_id", "lead_id");

-- CreateIndex
CREATE INDEX "Campaign_org_id_status_idx" ON "Campaign"("org_id", "status");

-- CreateIndex
CREATE INDEX "Lead_org_id_campaign_id_status_idx" ON "Lead"("org_id", "campaign_id", "status");

-- CreateIndex
CREATE INDEX "Lead_org_id_phone_number_idx" ON "Lead"("org_id", "phone_number");

-- CreateIndex
CREATE INDEX "Lead_campaign_id_next_call_at_idx" ON "Lead"("campaign_id", "next_call_at");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_org_id_is_active_idx" ON "WebhookEndpoint"("org_id", "is_active");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInvitation" ADD CONSTRAINT "UserInvitation_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInvitation" ADD CONSTRAINT "UserInvitation_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaEmailToken" ADD CONSTRAINT "MfaEmailToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DncRegistry" ADD CONSTRAINT "DncRegistry_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceCheck" ADD CONSTRAINT "ComplianceCheck_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingDisclosure" ADD CONSTRAINT "RecordingDisclosure_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
