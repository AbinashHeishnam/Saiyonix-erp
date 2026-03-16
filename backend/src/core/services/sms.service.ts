import { smsConfig } from "../config/externalServices";
import { logger } from "../../utils/logger";
import { sendWithTwilio } from "./sms/providers/twilio.provider";
import { sendWithMsg91 } from "./sms/providers/msg91.provider";
import type { SmsSendPayload } from "./sms/types";

export type SmsSendInput = {
  phoneNumber: string;
  message: string;
};

type SmsProvider = (payload: SmsSendPayload) => Promise<unknown>;

function resolveProvider(): SmsProvider | null {
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

export async function sendSMS(input: SmsSendInput): Promise<void> {
  const provider = resolveProvider();
  if (!provider) {
    logger.info("SMS provider disabled; skipping send");
    return;
  }

  await provider({
    phoneNumber: input.phoneNumber,
    message: input.message,
  });
}
