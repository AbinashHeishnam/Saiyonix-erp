import { env } from "@/config/env";
import { getConfigs } from "@/core/services/appConfig.service";
const CONFIG_KEYS = [
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
    "SMS_API_KEY",
    "SMS_SENDER_ID",
    "OTP_PROVIDER",
    "OTP_API_KEY",
];
export async function getSmsConfig(context = "default") {
    const config = await getConfigs([...CONFIG_KEYS]);
    const provider = config.OTP_PROVIDER ?? undefined;
    const smsApiKey = config.SMS_API_KEY ?? null;
    const otpApiKey = config.OTP_API_KEY ?? null;
    const apiKey = context === "otp" ? otpApiKey ?? smsApiKey : smsApiKey ?? otpApiKey;
    const senderId = config.SMS_SENDER_ID ?? undefined;
    const enabled = Boolean(provider && apiKey && senderId);
    return {
        provider,
        apiKey: apiKey ?? undefined,
        senderId,
        enabled,
    };
}
export async function getRazorpayConfig() {
    const config = await getConfigs([...CONFIG_KEYS]);
    const keyId = config.RAZORPAY_KEY_ID?.trim() || undefined;
    const keySecret = config.RAZORPAY_KEY_SECRET?.trim() || undefined;
    const webhookSecret = config.RAZORPAY_WEBHOOK_SECRET?.trim() || undefined;
    return {
        keyId,
        keySecret,
        webhookSecret,
        enabled: Boolean(keyId && keySecret),
    };
}
export const storageConfig = {
    provider: env.STORAGE_PROVIDER,
    bucket: env.STORAGE_BUCKET,
    region: env.STORAGE_REGION,
    accessKey: env.STORAGE_ACCESS_KEY,
    secretKey: env.STORAGE_SECRET_KEY,
    enabled: Boolean(env.STORAGE_PROVIDER &&
        env.STORAGE_BUCKET &&
        env.STORAGE_ACCESS_KEY &&
        env.STORAGE_SECRET_KEY),
};
