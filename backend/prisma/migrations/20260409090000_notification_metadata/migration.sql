-- AlterTable
ALTER TABLE "Notification"
ADD COLUMN     "eventType" TEXT,
ADD COLUMN     "entityType" TEXT,
ADD COLUMN     "entityId" TEXT,
ADD COLUMN     "linkUrl" TEXT,
ADD COLUMN     "metadata" JSONB;
