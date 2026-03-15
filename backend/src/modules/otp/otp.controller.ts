import type { NextFunction, Request, Response } from "express";

import { sendOtp, verifyOtp } from "./otp.service";
import { success } from "../../utils/apiResponse";

export async function sendOtpController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { mobile } = req.body as { mobile: string };
    const result = await sendOtp(mobile);
    return success(res, result, "OTP sent successfully");
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
    return success(res, result, "OTP verified successfully");
  } catch (error) {
    return next(error);
  }
}
