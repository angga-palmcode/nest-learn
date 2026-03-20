-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('prior_express', 'prior_express_written', 'implied');

-- CreateEnum
CREATE TYPE "DncSource" AS ENUM ('national_registry', 'internal_optout', 'manual');

-- CreateEnum
CREATE TYPE "ComplianceCheckType" AS ENUM ('consent', 'dnc', 'calling_window', 'recording_disclosure', 'optout_detection');

-- CreateEnum
CREATE TYPE "ComplianceCheckStatus" AS ENUM ('passed', 'failed', 'skipped');

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

-- CreateIndex
CREATE INDEX "DncRegistry_phone_number_org_id_idx" ON "DncRegistry"("phone_number", "org_id");

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DncRegistry" ADD CONSTRAINT "DncRegistry_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceCheck" ADD CONSTRAINT "ComplianceCheck_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingDisclosure" ADD CONSTRAINT "RecordingDisclosure_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
