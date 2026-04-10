import type { NextFunction, Request, Response } from "express";

import { resendOtp, sendOtp, verifyOtp } from "@/modules/otp/otp.service";
import { success } from "@/utils/apiResponse";
import { getOrCreateCsrfToken } from "@/core/security/csrf";

export async function sendOtpController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { mobile, channel } = req.body as { mobile: string; channel?: "sms" | "call" };
    const result = await sendOtp(mobile, channel);
    return success(res, result, "OTP sent successfully");
  } catch (error) {
    return next(error);
  }
}

export async function resendOtpController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { mobile, channel } = req.body as { mobile: string; channel?: "sms" | "call" };
    const result = await resendOtp(mobile, channel);
    return success(res, result, "OTP resent successfully");
  } catch (error) {
    return next(error);
  }
}

export async function verifyOtpController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { mobile, otp } = req.body as {
      mobile: string;
      otp: string;
    };

    const result = await verifyOtp(mobile, otp);
    const sameSite: "none" | "lax" =
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
