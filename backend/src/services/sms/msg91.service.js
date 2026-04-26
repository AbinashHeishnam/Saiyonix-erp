import axios from "axios";
import { ApiError } from "@/core/errors/apiError";
import { logger } from "@/utils/logger";
const MSG91_ENDPOINT = "https://control.msg91.com/api/v5/otp";
const DEFAULT_COUNTRY_CODE = "91";
function normalizePhone(input) {
    const digits = input.replace(/\D/g, "");
    if (digits.length === 10) {
        return `${DEFAULT_COUNTRY_CODE}${digits}`;
    }
    if (digits.length === 12 && digits.startsWith(DEFAULT_COUNTRY_CODE)) {
        return digits;
    }
    throw new ApiError(400, "Invalid phone number");
}
export async function sendPhoneOtp(phone, otp, mode) {
    const authKey = process.env.MSG91_AUTH_KEY;
    if (!authKey) {
        throw new ApiError(500, "OTP delivery is not configured");
    }
    const mobile = normalizePhone(phone);
    const templateId = process.env.MSG91_TEMPLATE_ID;
    try {
        const response = await axios.get(MSG91_ENDPOINT, {
            params: {
                authkey: authKey,
                mobile,
                otp,
                ...(templateId ? { template_id: templateId } : {}),
            },
            timeout: 10_000,
            validateStatus: (status) => status >= 200 && status < 300,
        });
        const data = response.data;
        const message = typeof data === "string"
            ? data
            : data?.message ?? data?.details ?? "unknown response";
        const type = typeof data === "string" ? undefined : data?.type ?? data?.status;
        const normalizedType = type?.toString().toLowerCase();
        const normalizedMessage = message.toString().toLowerCase();
        logger.info(`[OTP][MSG91] mode=${mode} status=${response.status} message=${message} mobile=${mobile}`);
        const isSuccess = normalizedType === "success" ||
            normalizedMessage.includes("success") ||
            normalizedMessage.includes("otp") ||
            normalizedMessage.includes("sent");
        logger.info(`[OTP][MSG91] mode=${mode} success=${isSuccess} mobile=${mobile}`);
        if (!isSuccess) {
            logger.error(`[OTP][MSG91] mode=${mode} send failed: ${message} mobile=${mobile}`);
            throw new ApiError(502, "OTP delivery failed");
        }
        return { success: true };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.error(`[OTP][MSG91] mode=${mode} send error: ${message} mobile=${mobile}`);
        throw new ApiError(502, "OTP delivery failed");
    }
}
export async function sendSMSOtp(phone, otp) {
    return sendPhoneOtp(phone, otp, "sms");
}
