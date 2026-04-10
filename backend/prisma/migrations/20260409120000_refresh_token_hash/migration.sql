-- Invalidate existing sessions to remove stored plaintext refresh tokens
DELETE FROM "Session";

-- Replace plaintext refresh token with hashed token
ALTER TABLE "Session" DROP CONSTRAINT IF EXISTS "Session_refreshToken_key";
ALTER TABLE "Session" DROP COLUMN IF EXISTS "refreshToken";
ALTER TABLE "Session" ADD COLUMN "refreshTokenHash" TEXT NOT NULL;

CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON "Session"("refreshTokenHash");
