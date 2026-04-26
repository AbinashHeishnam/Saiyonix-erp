import { resendOtp, sendOtp, verifyOtp } from "@/modules/otp/otp.service";
import { success } from "@/utils/apiResponse";
import { getOrCreateCsrfToken } from "@/core/security/csrf";
export async function sendOtpController(req, res, next) {
    try {
        const { mobile, studentNumber, channel } = req.body;
        const result = await sendOtp(mobile, studentNumber, channel);
        return success(res, result, "OTP sent successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function resendOtpController(req, res, next) {
    try {
        const { mobile, studentNumber, channel } = req.body;
        const result = await resendOtp(mobile, studentNumber, channel);
        return success(res, result, "OTP resent successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function verifyOtpController(req, res, next) {
    try {
        const { mobile, studentNumber, otp } = req.body;
        const result = await verifyOtp(mobile, studentNumber, otp);
        const sameSite = process.env.NODE_ENV === "production" ? "none" : "lax";
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
            result.csrfToken = csrfToken;
        }
        return success(res, result, "OTP verified successfully");
    }
    catch (error) {
        return next(error);
    }
}
