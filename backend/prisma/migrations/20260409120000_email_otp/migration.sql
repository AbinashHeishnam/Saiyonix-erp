-- CreateTable
CREATE TABLE "EmailOtpLog" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "isConsumed" BOOLEAN NOT NULL DEFAULT false,
    "lockedUntil" TIMESTAMP(3),
    "otpHash" TEXT NOT NULL,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,

    CONSTRAINT "EmailOtpLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailOtpLog_email_idx" ON "EmailOtpLog"("email");

-- CreateIndex
CREATE INDEX "EmailOtpLog_userId_idx" ON "EmailOtpLog"("userId");

-- CreateIndex
CREATE INDEX "EmailOtpLog_purpose_idx" ON "EmailOtpLog"("purpose");

-- AddForeignKey
ALTER TABLE "EmailOtpLog" ADD CONSTRAINT "EmailOtpLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
