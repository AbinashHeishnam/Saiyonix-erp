import { env } from "@/config/env";
import { logger } from "@/utils/logger";
import { ApiError } from "@/core/errors/apiError";

import { sendWithResend, type ResendEmailInput } from "./resend.service";

export type SendEmailInput = ResendEmailInput;

export async function sendEmail(input: SendEmailInput) {
  if (!env.EMAIL_ENABLED) {
    throw new ApiError(500, "Email delivery is disabled");
  }

  if (env.EMAIL_PROVIDER === "resend") {
    return sendWithResend(input);
  }

  throw new ApiError(500, "Email delivery is not configured");
}

export type OtpEmailInput = {
  to: string;
  otp: string;
  purpose: string;
  expiresInMinutes: number;
  schoolName?: string | null;
};

function formatOtpPurpose(purpose: string) {
  const normalized = purpose.toUpperCase();
  if (normalized.includes("RESET")) return "Password Reset";
  if (normalized.includes("ACTIVATE") || normalized.includes("SETUP")) return "Account Setup";
  if (normalized.includes("LOGIN")) return "Login";
  return "Verification";
}

export async function sendOtpEmail(params: OtpEmailInput) {
  const label = formatOtpPurpose(params.purpose);
  const subject = `${label} OTP`;
  const expiry = Math.max(params.expiresInMinutes, 1);
  const title = params.schoolName ? `${params.schoolName} ${label} OTP` : `${label} OTP`;

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.4;color:#111;">
      <h2 style="margin:0 0 12px 0;">${title}</h2>
      <p style="margin:0 0 8px 0;">Your one-time passcode is:</p>
      <div style="font-size:28px;font-weight:700;letter-spacing:4px;margin:8px 0 16px 0;">${params.otp}</div>
      <p style="margin:0 0 8px 0;">This code expires in ${expiry} minutes.</p>
      <p style="margin:0;">If you did not request this, you can ignore this email.</p>
    </div>
  `;

  const text = `${title}\n\nYour one-time passcode is: ${params.otp}\n\nThis code expires in ${expiry} minutes.\nIf you did not request this, you can ignore this email.`;

  if (env.NODE_ENV !== "production" && env.EMAIL_LOG_IN_DEV) {
    logger.info(`[DEV_OTP] ${params.purpose} email=${params.to} otp=${params.otp}`);
  }

  return sendEmail({
    to: params.to,
    subject,
    html,
    text,
    tags: [
      { name: "purpose", value: params.purpose },
      { name: "type", value: "otp" },
    ],
  });
}
