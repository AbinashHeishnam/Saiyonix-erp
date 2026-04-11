import { ApiError } from "@/core/errors/apiError";
import { sendPhoneOtp as sendTwoFactorOtp } from "@/services/sms/twofactor.service";
import { sendPhoneOtp as sendMsg91Otp } from "@/services/sms/msg91.service";
import { assertOtpDeliveryConfigured, resolveOtpDeliveryMode } from "@/services/sms/config";
import type { OtpDeliveryMode } from "@/services/sms/types";
import { logger } from "@/utils/logger";

function normalizeMobileForLog(input: string) {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits || input;
}

export async function sendPhoneOtp(
  mobile: string,
  otp: string,
  requestedMode?: OtpDeliveryMode
) {
  const normalizedMobile = normalizeMobileForLog(mobile);
  const configured = await assertOtpDeliveryConfigured();
  const mode = requestedMode ?? configured.mode;
  const provider = configured.provider;

  if (requestedMode && requestedMode !== configured.mode) {
    logger.warn(
      `[OTP] delivery_mode_mismatch requested=${requestedMode} configured=${configured.mode} mobile=${normalizedMobile}`
    );
  }

  logger.info(
    `[OTP] delivery_attempt mode=${mode} provider=${provider} mobile=${normalizedMobile}`
  );

  try {
    if (provider === "twofactor") {
      await sendTwoFactorOtp(mobile, otp, mode);
    } else if (provider === "msg91") {
      await sendMsg91Otp(mobile, otp, mode);
    } else {
      throw new ApiError(500, "OTP delivery is not configured");
    }

    logger.info(
      `[OTP] delivery_success mode=${mode} provider=${provider} mobile=${normalizedMobile}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error(
      `[OTP] delivery_failed mode=${mode} provider=${provider} mobile=${normalizedMobile} error=${message}`
    );
    throw error;
  }
}

export async function sendOTP(mobile: string, otp: string) {
  return sendPhoneOtp(mobile, otp, resolveOtpDeliveryMode());
}
