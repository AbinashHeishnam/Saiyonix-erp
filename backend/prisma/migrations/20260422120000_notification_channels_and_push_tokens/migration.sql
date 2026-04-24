-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ATTENDANCE', 'NOTICE', 'GENERAL');

-- CreateEnum
CREATE TYPE "PushPlatform" AS ENUM ('EXPO', 'WEB');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('MOBILE_PUSH', 'WEB_PUSH', 'IN_APP');

-- CreateEnum
CREATE TYPE "NotificationLogStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'INVALID_TOKEN', 'SKIPPED');

-- AlterTable
ALTER TABLE "Notification"
ADD COLUMN "type" "NotificationType" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN "data" JSONB;

-- CreateTable
CREATE TABLE "PushToken" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "PushPlatform" NOT NULL,
    "deviceInfo" JSONB,
    "subscription" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invalidatedAt" TIMESTAMP(3),

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "notificationRecipientId" TEXT,
    "pushTokenId" TEXT,
    "userId" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "platform" "PushPlatform",
    "status" "NotificationLogStatus" NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_schoolId_type_createdAt_idx" ON "Notification"("schoolId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationRecipient_userId_readAt_idx" ON "NotificationRecipient"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushToken_userId_token_key" ON "PushToken"("userId", "token");

-- CreateIndex
CREATE UNIQUE INDEX "PushToken_schoolId_token_key" ON "PushToken"("schoolId", "token");

-- CreateIndex
CREATE INDEX "PushToken_schoolId_platform_idx" ON "PushToken"("schoolId", "platform");

-- CreateIndex
CREATE INDEX "PushToken_userId_platform_idx" ON "PushToken"("userId", "platform");

-- CreateIndex
CREATE INDEX "PushToken_invalidatedAt_idx" ON "PushToken"("invalidatedAt");

-- CreateIndex
CREATE INDEX "NotificationLog_schoolId_status_createdAt_idx" ON "NotificationLog"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_notificationId_channel_idx" ON "NotificationLog"("notificationId", "channel");

-- CreateIndex
CREATE INDEX "NotificationLog_notificationRecipientId_idx" ON "NotificationLog"("notificationRecipientId");

-- CreateIndex
CREATE INDEX "NotificationLog_pushTokenId_idx" ON "NotificationLog"("pushTokenId");

-- CreateIndex
CREATE INDEX "NotificationLog_userId_createdAt_idx" ON "NotificationLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_notificationRecipientId_fkey" FOREIGN KEY ("notificationRecipientId") REFERENCES "NotificationRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_pushTokenId_fkey" FOREIGN KEY ("pushTokenId") REFERENCES "PushToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
