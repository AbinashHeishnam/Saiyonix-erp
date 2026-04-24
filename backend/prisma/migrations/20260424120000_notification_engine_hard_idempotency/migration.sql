-- Harden notification idempotency (DB-level) + parent link safety

-- AlterTable
ALTER TABLE "NotificationRecipient"
ADD COLUMN "entityId" TEXT,
ADD COLUMN "type" TEXT NOT NULL DEFAULT 'GENERAL';

-- Unique index for hard idempotency (per user + event type + entity)
CREATE UNIQUE INDEX "NotificationRecipient_userId_type_entityId_key"
ON "NotificationRecipient"("userId", "type", "entityId");

-- Parent link safety
ALTER TABLE "ParentStudentLink"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "ParentStudentLink_studentId_isActive_idx"
ON "ParentStudentLink"("studentId", "isActive");

