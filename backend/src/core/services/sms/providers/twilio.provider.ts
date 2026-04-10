import type { SmsConfig } from "@/core/config/externalServices";
import type { SmsSendPayload, SmsSendResult } from "@/core/services/sms/types";

export async function sendWithTwilio(
  config: SmsConfig,
  payload: SmsSendPayload
): Promise<SmsSendResult> {
  const { apiKey, senderId } = config;
  if (!apiKey || !senderId) {
    throw new Error("Twilio configuration missing");
  }

  // Placeholder request structure. Real credentials can be wired via env without code changes.
  const response = await fetch("https://api.twilio.com/2010-04-01/Accounts/messages.json", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: payload.phoneNumber,
      From: senderId,
      Body: payload.message,
    }),
  });

  if (!response.ok) {
    throw new Error("Twilio SMS request failed");
  }

  return { provider: "twilio" };
}
