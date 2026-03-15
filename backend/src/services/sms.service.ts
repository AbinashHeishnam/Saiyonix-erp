import { logger } from "../utils/logger";

export async function sendOTP(mobile: string, otp: string) {
  // Placeholder adapter for future SMS gateway integration.
  void otp;
  logger.info(`[SMS] OTP dispatch requested for mobile=${mobile}`);
}
