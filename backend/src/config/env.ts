import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  PORT: z
    .string()
    .default("3000")
    .transform((val) => Number(val)),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  JWT_SECRET: z.string().min(10, "JWT_SECRET must be at least 10 characters"),

  ALLOW_PUBLIC_REGISTRATION: z.string().optional().default("false"),
  DEBUG_ROUTES_ENABLED: z.string().optional().default("false"),
  SMS_OTP_LOG: z.string().optional().default("false"),
  OTP_DELIVERY_MODE: z.enum(["call", "sms"]).optional().default("call"),

  WORKER_ENABLED: z.string().optional(),
  REDIS_ENABLED: z.string().optional(),
  REDIS_URL: z.string().optional(),
  JOB_CONCURRENCY: z.string().optional(),

  OTP_SECRET: z.string().optional(),
  SMS_PROVIDER_KEY: z.string().optional(),
  SMS_PROVIDER: z.string().optional(),
  SMS_API_KEY: z.string().optional(),
  SMS_SENDER_ID: z.string().optional(),
  EMAIL_OTP_MODE: z.enum(["log", "email", "both"]).optional().default("log"),
  EMAIL_PROVIDER: z.enum(["resend"]).optional().default("resend"),
  EMAIL_ENABLED: z
    .string()
    .optional()
    .default("false")
    .transform((val) => val.toLowerCase() === "true"),
  EMAIL_LOG_IN_DEV: z
    .string()
    .optional()
    .default("false")
    .transform((val) => val.toLowerCase() === "true"),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  EMAIL_OTP_EXPIRY_MINUTES: z
    .string()
    .optional()
    .default("5")
    .transform((val) => Number(val))
    .refine((val) => Number.isFinite(val) && val > 0, "EMAIL_OTP_EXPIRY_MINUTES must be a number"),
  EMAIL_OTP_RESEND_COOLDOWN_SECONDS: z
    .string()
    .optional()
    .default("60")
    .transform((val) => Number(val))
    .refine(
      (val) => Number.isFinite(val) && val > 0,
      "EMAIL_OTP_RESEND_COOLDOWN_SECONDS must be a number"
    ),
  EMAIL_OTP_MAX_ATTEMPTS: z
    .string()
    .optional()
    .default("5")
    .transform((val) => Number(val))
    .refine((val) => Number.isFinite(val) && val > 0, "EMAIL_OTP_MAX_ATTEMPTS must be a number"),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  STORAGE_PROVIDER: z.string().optional(),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_REGION: z.string().optional(),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables");
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;

if (env.NODE_ENV === "production" && env.REDIS_ENABLED !== "false" && !env.REDIS_URL) {
  console.error("❌ REDIS_URL is required in production when REDIS_ENABLED is true");
  process.exit(1);
}

if (env.NODE_ENV === "production" && env.EMAIL_ENABLED && env.EMAIL_PROVIDER === "resend") {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    console.error("❌ RESEND_API_KEY and RESEND_FROM_EMAIL are required when EMAIL_ENABLED is true");
    process.exit(1);
  }
}
