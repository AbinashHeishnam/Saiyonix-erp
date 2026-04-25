-- Add Expo project identifier to support multi-app push grouping.
ALTER TABLE "PushToken" ADD COLUMN "projectId" TEXT;

-- Optional index to speed up grouping/cleanup queries by projectId.
CREATE INDEX "PushToken_projectId_idx" ON "PushToken"("projectId");

