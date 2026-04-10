import { Resend } from "resend";

import { env } from "@/config/env";
import { logger } from "@/utils/logger";
import { ApiError } from "@/core/errors/apiError";

export type ResendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
};

let resendClient: Resend | null = null;

function getResendClient() {
  if (!env.RESEND_API_KEY) {
    throw new ApiError(500, "Email delivery is not configured");
  }

  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }

  return resendClient;
}

export async function sendWithResend(input: ResendEmailInput) {
  if (!env.RESEND_FROM_EMAIL) {
    throw new ApiError(500, "Email delivery is not configured");
  }

  const resend = getResendClient();

  try {
    const result = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
      tags: input.tags,
    });

    if (result?.error) {
      logger.error(`[EMAIL] Resend failed: ${result.error.message}`);
      throw new ApiError(502, "Email delivery failed");
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error(`[EMAIL] Resend error: ${message}`);
    throw new ApiError(502, "Email delivery failed");
  }
}
