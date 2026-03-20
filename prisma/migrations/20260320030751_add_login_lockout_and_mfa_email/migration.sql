-- AlterTable
ALTER TABLE "User" ADD COLUMN     "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "locked_until" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MfaEmailToken" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MfaEmailToken_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MfaEmailToken" ADD CONSTRAINT "MfaEmailToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
