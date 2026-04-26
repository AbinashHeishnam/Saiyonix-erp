import { getSmsConfig } from "@/core/config/externalServices";
import { logger } from "@/utils/logger";
import { sendWithTwilio } from "@/core/services/sms/providers/twilio.provider";
import { sendWithMsg91 } from "@/core/services/sms/providers/msg91.provider";
async function resolveProvider(context) {
    const smsConfig = await getSmsConfig(context);
    if (!smsConfig.enabled) {
        return null;
    }
    if (!smsConfig.senderId) {
        logger.info("SMS sender ID missing; skipping send");
        return null;
    }
    const provider = smsConfig.provider?.toLowerCase();
    if (provider === "twilio") {
        return (payload) => sendWithTwilio(smsConfig, payload);
    }
    if (provider === "msg91") {
        return (payload) => sendWithMsg91(smsConfig, payload);
    }
    logger.info("SMS provider not configured or unsupported");
    return null;
}
export async function sendSMS(input) {
    const provider = await resolveProvider(input.context ?? "default");
    if (!provider) {
        logger.info("SMS provider disabled; skipping send");
        return;
    }
    await provider({
        phoneNumber: input.phoneNumber,
        message: input.message,
    });
}
