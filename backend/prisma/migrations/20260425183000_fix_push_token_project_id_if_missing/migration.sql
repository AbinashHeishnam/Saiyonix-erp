-- Hotfix migration:
-- Some environments have migration history marked as applied but the column is missing.
-- This migration is idempotent and safely adds the column/index only if absent.

ALTER TABLE "PushToken" ADD COLUMN IF NOT EXISTS "projectId" TEXT;

CREATE INDEX IF NOT EXISTS "PushToken_projectId_idx" ON "PushToken"("projectId");

