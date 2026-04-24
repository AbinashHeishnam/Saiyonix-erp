# Real-Time Notifications (In-App + Push)

This repo uses a unified notification pipeline:

- In-app inbox: `Notification` + `NotificationRecipient` (per-user read state)
- Multi-device tokens: `PushToken` (supports Expo + FCM)
- Delivery debugging: `NotificationLog`
- Async delivery: BullMQ queue (`notifications`)

## Database / Prisma

1. Apply migrations:

```bash
cd backend
npx prisma migrate deploy
```

2. Regenerate Prisma client:

```bash
cd backend
npx prisma generate
```

## Environment Variables (Backend)

- `WORKER_ENABLED=true` (starts BullMQ workers)
- `REDIS_ENABLED=true` and `REDIS_URL=...` (recommended for async delivery)
- `FIREBASE_SERVICE_ACCOUNT_JSON=...` (service account JSON string; preferred)
  - OR: `FIREBASE_PROJECT_ID=...`, `FIREBASE_CLIENT_EMAIL=...`, `FIREBASE_PRIVATE_KEY=...`
- `FIREBASE_WEB_CONFIG_JSON=...` (public Firebase web config JSON used by the web app + service worker)
- `FIREBASE_VAPID_KEY=...` (public VAPID key from Firebase Console → Cloud Messaging → Web push certificates; required for web `getToken()`)
- Optional: `EXPO_ACCESS_TOKEN=...` (only needed for certain Expo setups; push works with Expo tokens regardless)

## Environment Variables (Frontend)

- `VITE_API_BASE_URL=http://localhost:3000/api/v1`
- The web client fetches the VAPID key from `GET /api/v1/notifications/fcm/web-config` and must not hardcode it.

## Mobile Push (Expo)

The mobile apps register an Expo push token after login and send it to:

- `POST /api/v1/notifications/register-token` with `platform=expo`

Ensure the app has a valid EAS project id configured (already present in `apps/*/app.config.ts`).

## Curl Examples

### 1) Register Expo token

```bash
curl -X POST "$API/api/v1/notifications/register-token" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "platform":"expo",
    "token":"ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    "deviceInfo":{"platform":"android","deviceName":"Pixel 7"}
  }'
```

### 2) Register Web Push subscription

```bash
curl -X POST "$API/api/v1/notifications/fcm/register" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "token":"FCM_REGISTRATION_TOKEN"
  }'
```

### 3) Remove token (Expo)

```bash
curl -X POST "$API/api/v1/notifications/remove-token" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "token":"ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" }'
```

### 4) Unregister FCM token (Web)

```bash
curl -X POST "$API/api/v1/notifications/fcm/unregister" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "token":"FCM_REGISTRATION_TOKEN" }'
```

### 5) Trigger attendance (teacher)

```bash
curl -X POST "$API/api/v1/attendance" \
  -H "Authorization: Bearer $TEACHER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sectionId":"SECTION_UUID",
    "academicYearId":"AY_UUID",
    "timetableSlotId":"SLOT_UUID",
    "records":[{"studentId":"STUDENT_UUID","status":"ABSENT"}]
  }'
```

### 6) Trigger notice (admin)

```bash
curl -X POST "$API/api/v1/notices" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"School Notice",
    "content":"Tomorrow is a holiday.",
    "noticeType":"GENERAL",
    "targetType":"ALL"
  }'
```

## Observability

- Delivery attempts write rows to `NotificationLog` with channel + status + error details.
- Invalid Expo/Web tokens are automatically marked `invalidatedAt` in `PushToken`.
- `NotificationRecipient.deliveryStatus` tracks high-level per-user delivery state (`DELIVERED`, `PARTIAL`, `RETRY`, etc.).
