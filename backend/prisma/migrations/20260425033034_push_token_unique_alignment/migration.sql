-- Align DB constraints with Prisma schema: token is not globally unique.
-- Some environments may have drifted (e.g., via prisma db push) and created a unique index on ("token").
-- This migration makes registration idempotent by ensuring the ON CONFLICT target matches a real unique index.

-- Drop the potentially-drifted unique constraint/index on token (if it exists).
ALTER TABLE "PushToken" DROP CONSTRAINT IF EXISTS "PushToken_token_key";
DROP INDEX IF EXISTS "PushToken_token_key";

-- Drop token uniqueness scoped to school (this breaks multi-user-on-one-device scenarios).
ALTER TABLE "PushToken" DROP CONSTRAINT IF EXISTS "PushToken_schoolId_token_key";
DROP INDEX IF EXISTS "PushToken_schoolId_token_key";

-- Ensure user+token uniqueness exists (safe no-op if already present).
CREATE UNIQUE INDEX IF NOT EXISTS "PushToken_userId_token_key" ON "PushToken"("userId", "token");
