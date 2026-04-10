import type { NextFunction, Request, Response } from "express";

import {
  requestEmailOtp,
  resendEmailOtp,
  verifyEmailOtp,
} from "@/modules/emailOtp/emailOtp.service";
import { success } from "@/utils/apiResponse";
import { getOrCreateCsrfToken } from "@/core/security/csrf";

export async function requestEmailOtpController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { email } = req.body as { email: string };
    const result = await requestEmailOtp(email);
    return success(res, result, "OTP sent successfully");
  } catch (error) {
    return next(error);
  }
}

export async function resendEmailOtpController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { email } = req.body as { email: string };
    const result = await resendEmailOtp(email);
    return success(res, result, "OTP resent successfully");
  } catch (error) {
    return next(error);
  }
}

export async function verifyEmailOtpController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { email, otp } = req.body as { email: string; otp: string };
    const result = await verifyEmailOtp(email, otp);
    const sameSite: "lax" | "none" =
      process.env.NODE_ENV === "production" ? "none" : "lax";
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite,
    };
    if (result?.accessToken) {
      res.cookie("accessToken", result.accessToken, cookieOptions);
      res.cookie("access_token", result.accessToken, cookieOptions);
    }
    if (result?.refreshToken) {
      res.cookie("refreshToken", result.refreshToken, cookieOptions);
    }
    const userId = result?.userId ?? result?.user?.id;
    if (userId) {
      const csrfToken = getOrCreateCsrfToken(userId, true);
      (result as typeof result & { csrfToken?: string }).csrfToken = csrfToken;
    }
    return success(res, result, "OTP verified successfully");
  } catch (error) {
    return next(error);
  }
}
