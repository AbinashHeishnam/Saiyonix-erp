import { env } from "../../config/env";
import { logger } from "../../utils/logger";

export type SmsProviderName = "twilio" | "msg91" | string;

export type SmsConfig = {
  provider?: SmsProviderName;
  apiKey?: string;
  senderId?: string;
  enabled: boolean;
};

export type RazorpayConfig = {
  keyId?: string;
  keySecret?: string;
  enabled: boolean;
};

export type StorageProviderName = "s3" | "r2" | "minio" | string;

export type StorageConfig = {
  provider?: StorageProviderName;
  bucket?: string;
  region?: string;
  accessKey?: string;
  secretKey?: string;
  enabled: boolean;
};

const smsApiKey = env.SMS_API_KEY ?? env.SMS_PROVIDER_KEY;

export const smsConfig: SmsConfig = {
  provider: env.SMS_PROVIDER,
  apiKey: smsApiKey,
  senderId: env.SMS_SENDER_ID,
  enabled: Boolean(env.SMS_PROVIDER && smsApiKey),
};

export const razorpayConfig: RazorpayConfig = {
  keyId: env.RAZORPAY_KEY_ID,
  keySecret: env.RAZORPAY_KEY_SECRET,
  enabled: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
};

export const storageConfig: StorageConfig = {
  provider: env.STORAGE_PROVIDER,
  bucket: env.STORAGE_BUCKET,
  region: env.STORAGE_REGION,
  accessKey: env.STORAGE_ACCESS_KEY,
  secretKey: env.STORAGE_SECRET_KEY,
  enabled: Boolean(
    env.STORAGE_PROVIDER &&
      env.STORAGE_BUCKET &&
      env.STORAGE_ACCESS_KEY &&
      env.STORAGE_SECRET_KEY
  ),
};

if (!smsConfig.enabled) {
  logger.info("SMS provider disabled");
}

if (!razorpayConfig.enabled) {
  logger.info("Razorpay provider disabled");
}

if (!storageConfig.enabled) {
  logger.info("Storage provider disabled; using local disk storage");
}
