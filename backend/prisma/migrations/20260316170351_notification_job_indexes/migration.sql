/*
  Warnings:

  - You are about to drop the column `fileUrl` on the `Circular` table. All the data in the column will be lost.
  - You are about to drop the column `summary` on the `Circular` table. All the data in the column will be lost.
  - Added the required column `body` to the `Circular` table without a default value. This is not possible if the table is not empty.
  - Added the required column `targetType` to the `Circular` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CircularTargetType" AS ENUM ('ALL', 'CLASS', 'SECTION', 'ROLE');

-- CreateEnum
CREATE TYPE "NoticeTargetType" AS ENUM ('ALL', 'CLASS', 'SECTION', 'ROLE');

-- AlterTable
ALTER TABLE "Circular" DROP COLUMN "fileUrl",
DROP COLUMN "summary",
ADD COLUMN     "attachments" JSONB,
ADD COLUMN     "body" TEXT NOT NULL,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "targetClassId" TEXT,
ADD COLUMN     "targetRole" "UserRole",
ADD COLUMN     "targetSectionId" TEXT,
ADD COLUMN     "targetType" "CircularTargetType" NOT NULL;

-- AlterTable
ALTER TABLE "NoticeBoard" ADD COLUMN     "targetClassId" TEXT,
ADD COLUMN     "targetRole" "UserRole",
ADD COLUMN     "targetSectionId" TEXT,
ADD COLUMN     "targetType" "NoticeTargetType" NOT NULL DEFAULT 'ALL';

-- CreateTable
CREATE TABLE "NotificationJob" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationJob_idempotencyKey_key" ON "NotificationJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "NotificationJob_schoolId_idx" ON "NotificationJob"("schoolId");

-- CreateIndex
CREATE INDEX "NotificationJob_status_idx" ON "NotificationJob"("status");

-- CreateIndex
CREATE INDEX "NotificationJob_createdAt_idx" ON "NotificationJob"("createdAt");

-- CreateIndex
CREATE INDEX "Circular_publishedAt_idx" ON "Circular"("publishedAt");

-- CreateIndex
CREATE INDEX "Circular_expiresAt_idx" ON "Circular"("expiresAt");

-- CreateIndex
CREATE INDEX "NoticeBoard_publishedAt_idx" ON "NoticeBoard"("publishedAt");

-- CreateIndex
CREATE INDEX "NoticeBoard_expiresAt_idx" ON "NoticeBoard"("expiresAt");

-- CreateIndex
CREATE INDEX "StudentAttendance_attendanceDate_idx" ON "StudentAttendance"("attendanceDate");

-- CreateIndex
CREATE INDEX "StudentAttendance_sectionId_idx" ON "StudentAttendance"("sectionId");
