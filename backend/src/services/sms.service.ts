import { sendSMS } from "../core/services/sms.service";
import { logger } from "../utils/logger";

export async function sendOTP(mobile: string, otp: string) {
  const message = `Your OTP is ${otp}`;
  try {
    await sendSMS({ phoneNumber: mobile, message });
  } catch (error) {
    logger.info(`[SMS] OTP dispatch failed for mobile=${mobile}`);
  }
}
