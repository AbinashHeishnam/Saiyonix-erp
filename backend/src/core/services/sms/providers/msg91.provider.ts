import type { SmsConfig } from "@/core/config/externalServices";
import type { SmsSendPayload, SmsSendResult } from "@/core/services/sms/types";

export async function sendWithMsg91(
  config: SmsConfig,
  payload: SmsSendPayload
): Promise<SmsSendResult> {
  const { apiKey, senderId } = config;
  if (!apiKey || !senderId) {
    throw new Error("MSG91 configuration missing");
  }

  const params = new URLSearchParams({
    authkey: apiKey,
    sender: senderId,
    mobiles: payload.phoneNumber.replace(/\D/g, ""),
    message: payload.message,
    route: "4",
    country: "91",
  });

  const response = await fetch(`https://control.msg91.com/api/v5/flow?${params.toString()}`, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error("MSG91 SMS request failed");
  }

  return { provider: "msg91" };
}
