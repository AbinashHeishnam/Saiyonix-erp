import { z } from "zod";

// Legacy endpoint kept for Expo (existing mobile clients).
// Web push (VAPID/web-push) is removed; web clients must use /notifications/fcm/*.
export const pushPlatformSchema = z.enum(["expo"]);

const expoTokenSchema = z
  .string()
  .trim()
  .min(20)
  .max(200)
  .refine(
    (value) => /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9-]{10,}\]$/.test(value),
    "Invalid Expo push token format"
  );

export const registerTokenSchema = z
  .object({
    token: z.string().trim().min(5).max(2048),
    platform: pushPlatformSchema,
    deviceInfo: z.unknown().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const parsed = expoTokenSchema.safeParse(data.token);
    if (!parsed.success) {
      ctx.addIssue({
        code: "custom",
        path: ["token"],
        message: parsed.error.issues[0]?.message ?? "Invalid Expo push token",
      });
    }
  });

export const removeTokenSchema = z
  .object({
    token: z.string().trim().min(5).max(2048),
  })
  .strict();

export type RegisterTokenInput = z.infer<typeof registerTokenSchema>;
export type RemoveTokenInput = z.infer<typeof removeTokenSchema>;
