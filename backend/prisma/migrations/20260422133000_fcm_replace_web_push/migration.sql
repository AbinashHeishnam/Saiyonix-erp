/*
  Replace legacy WEB (VAPID/web-push) with FCM.

  - Drops PushToken.subscription (web-push-only)
  - Replaces PushPlatform enum values: WEB -> FCM
  - Deletes existing WEB push tokens (endpoints/subscriptions are not FCM tokens)
  - Normalizes historical NotificationLog.platform=WEB to NULL
*/

-- Delete legacy web-push subscriptions (tokens are endpoints, not FCM registration tokens).
DELETE FROM "PushToken" WHERE "platform" = 'WEB';

-- Keep historical logs readable by Prisma after enum change.
UPDATE "NotificationLog" SET "platform" = NULL WHERE "platform" = 'WEB';

-- Drop legacy subscription payload.
ALTER TABLE "PushToken" DROP COLUMN IF EXISTS "subscription";

-- Replace enum value WEB -> FCM (Postgres enums can't drop values easily; recreate type).
CREATE TYPE "PushPlatform_new" AS ENUM ('EXPO', 'FCM');

ALTER TABLE "PushToken"
ALTER COLUMN "platform" TYPE "PushPlatform_new"
USING (CASE WHEN "platform"::text = 'WEB' THEN 'FCM' ELSE "platform"::text END)::"PushPlatform_new";

ALTER TABLE "NotificationLog"
ALTER COLUMN "platform" TYPE "PushPlatform_new"
USING (CASE WHEN "platform"::text = 'WEB' THEN NULL ELSE "platform"::text END)::"PushPlatform_new";

ALTER TYPE "PushPlatform" RENAME TO "PushPlatform_old";
ALTER TYPE "PushPlatform_new" RENAME TO "PushPlatform";
DROP TYPE "PushPlatform_old";

