import { z } from "zod";
// FCM registration tokens are opaque strings; validate conservatively.
const fcmTokenSchema = z
    .string()
    .trim()
    .min(20)
    .max(4096)
    .refine((value) => /^[A-Za-z0-9:_-]+$/.test(value), "Invalid FCM token format");
export const registerFcmSchema = z
    .object({
    token: fcmTokenSchema,
})
    .strict();
export const unregisterFcmSchema = z
    .object({
    token: fcmTokenSchema,
})
    .strict();
